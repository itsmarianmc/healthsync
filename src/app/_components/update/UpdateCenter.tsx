'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Serwist } from '@serwist/window';
import { useAppShell } from '../../_context/AppShellContext';
import { useAuth } from '../../_context/AuthContext';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import {
    compareVersions,
    fetchChangelogEntries,
    fetchLastSeenChangelogVersion,
    pickHigherVersion,
    readLocalLastSeen,
    readPendingReloadAfterUpdate,
    storeLastSeenChangelogVersion,
    syncLastSeenVersion,
    writeLocalLastSeen,
    writePendingReloadAfterUpdate,
    type ChangelogEntry,
} from '../../_lib/changelog';
import { APP_VERSION } from '../../_lib/release';

const UPDATE_AVAILABLE_STORAGE_KEY = 'healthsync_update_available';
const DISMISSED_BANNER_STORAGE_KEY = 'healthsync_dismissed_banner';
const UPDATE_CENTER_ALLOWED_ROUTES = ['/dash', '/food', '/drinks'];

type SerwistWindow = Window & {
    serwist?: Serwist;
};

function readDismissedBanner(): boolean {
    try {
        return localStorage.getItem(DISMISSED_BANNER_STORAGE_KEY) === 'true';
    } catch (error) {
        console.log('[changelog] localStorage read error:', error);
        return false;
    }
}

function writeDismissedBanner(dismissed: boolean): void {
    try {
        localStorage.setItem(DISMISSED_BANNER_STORAGE_KEY, String(dismissed));
    } catch (error) {
        console.log('[changelog] localStorage write error:', error);
    }
}

function readUpdateAvailable(): boolean {
    try {
        return localStorage.getItem(UPDATE_AVAILABLE_STORAGE_KEY) === 'true';
    } catch (error) {
        console.log('[changelog] localStorage read error:', error);
        return false;
    }
}

const UPDATE_AVAILABLE_CHANGED_EVENT = 'healthsync:update-available-changed';

function writeUpdateAvailable(available: boolean): void {
    try {
        localStorage.setItem(UPDATE_AVAILABLE_STORAGE_KEY, String(available));
    } catch (error) {
        console.log('[changelog] localStorage write error:', error);
    }
    window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE_CHANGED_EVENT, { detail: available }));
}

function sortEntries(entries: ChangelogEntry[]): ChangelogEntry[] {
    return [...entries].sort((left, right) => {
        const versionDelta = compareVersions(right.version, left.version);
        if (versionDelta !== 0) return versionDelta;

        const timeDelta = new Date(right.created_at ?? 0).getTime() - new Date(left.created_at ?? 0).getTime();
        if (timeDelta !== 0) return timeDelta;

        return right.title.localeCompare(left.title, undefined, { sensitivity: 'base' });
    });
}

function isUpdateCenterAllowedRoute(pathname: string | null): boolean {
    if (!pathname) return false;
    return UPDATE_CENTER_ALLOWED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export default function UpdateCenter() {
    const { user } = useAuth();
    const pathname = usePathname();
    const isAllowedRoute = isUpdateCenterAllowedRoute(pathname);
    const { updateCenterOpen, openUpdateCenter, closeUpdateCenter } = useAppShell();
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [dismissedBanner, setDismissedBanner] = useState(false);
    const [entries, setEntries] = useState<ChangelogEntry[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [hasPendingChangelog, setHasPendingChangelog] = useState(false);
    const reloadAfterUpdateRef = useRef(false);
    const bootstrapRef = useRef(false);
    const profileSeenVersionRef = useRef<string | null>(null);
    const expandTimerRef = useRef<number | null>(null);
    const serverChangelogResponseRef = useRef<{ profileSeenVersion: string | null; entries: ChangelogEntry[] } | null>(null);

    const sheet = useDraggableSheet({
        onClose: () => {
            closeUpdateCenter();
            const seenVersion = profileSeenVersionRef.current ?? APP_VERSION;
            writeLocalLastSeen(seenVersion);
            if (user?.id) {
                void storeLastSeenChangelogVersion(user.id, seenVersion);
            }
        },
        transitionDurationMs: 500,
        transitionEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        closeTransitionDurationMs: 260,
        closeTransitionEasing: 'ease-in',
    });
    const { open, close, snapToExpanded, handleProps, setOverlayRef, setModalRef, stateRef } = sheet;

    useEffect(() => {
        if (typeof window === 'undefined' || bootstrapRef.current || !('serviceWorker' in navigator)) {
            return;
        }

        bootstrapRef.current = true;
        const globalWindow = window as SerwistWindow;
        const serwist = new Serwist('/serwist/sw.js', { type: 'module', scope: '/' });
        globalWindow.serwist = serwist;

        const persistedUpdateAvailable = readUpdateAvailable();
        const persistedDismissedBanner = readDismissedBanner();
        if (persistedUpdateAvailable) {
            setUpdateAvailable(true);
        }
        if (persistedDismissedBanner) {
            setDismissedBanner(true);
        }

        const handleWaiting = () => {
            setUpdateAvailable(true);
            writeUpdateAvailable(true);
            setDismissedBanner(false);
            writeDismissedBanner(false);
        };

        const handleControllerChange = () => {
            if (!reloadAfterUpdateRef.current && !readPendingReloadAfterUpdate()) return;
            reloadAfterUpdateRef.current = false;
            writePendingReloadAfterUpdate(false);
            setUpdateAvailable(false);
            writeUpdateAvailable(false);
            window.location.reload();
        };

        serwist.addEventListener('waiting', handleWaiting);
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        void serwist.register({ immediate: true }).then(async () => {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (!registration?.waiting) {
                    setUpdateAvailable(false);
                    writeUpdateAvailable(false);
                }
            } catch (error) {
                console.log('[changelog] registration check error:', error);
            }
        });

        return () => {
            serwist.removeEventListener('waiting', handleWaiting);
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadChangelog = async () => {
            setLoadingEntries(true);
            setLoadError(null);

            try {
                const [profileSeenVersion, allEntries] = await Promise.all([
                    user?.id ? fetchLastSeenChangelogVersion(user.id) : Promise.resolve(null),
                    fetchChangelogEntries(),
                ]);

                serverChangelogResponseRef.current = {
                    profileSeenVersion,
                    entries: allEntries,
                };

                if (cancelled) return;

                const localSeenVersion = readLocalLastSeen();
                const lastSeenVersion = pickHigherVersion(profileSeenVersion, localSeenVersion);
                const currentEntries = sortEntries(
                    allEntries.filter((entry) => compareVersions(entry.version, APP_VERSION) <= 0)
                );
                const unseenEntries = currentEntries.filter((entry) => {
                    if (!lastSeenVersion) return true;
                    return compareVersions(entry.version, lastSeenVersion) > 0;
                });

                if (currentEntries.length > 0) {
                    profileSeenVersionRef.current = profileSeenVersion;
                    setEntries(currentEntries);
                    if (unseenEntries.length > 0) {
                        setHasPendingChangelog(true);
                    }
                    // FIX: compare local version with Supabase; if local is higher -> update Supabase
                    if (user?.id && lastSeenVersion) {
                        void syncLastSeenVersion(user.id, lastSeenVersion, profileSeenVersion);
                    }
                } else {
                    profileSeenVersionRef.current = profileSeenVersion;
                    writeLocalLastSeen(APP_VERSION);
                    if (user?.id) {
                        void syncLastSeenVersion(user.id, APP_VERSION, profileSeenVersion);
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    setLoadError('Could not load the latest updates.');
                }
                console.error('[changelog] load error:', error);
            } finally {
                if (!cancelled) setLoadingEntries(false);
            }
        };

        void loadChangelog();

        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    useEffect(() => {
        if (hasPendingChangelog && isAllowedRoute && !updateCenterOpen && profileSeenVersionRef.current !== null) {
            openUpdateCenter();
            setHasPendingChangelog(false);
        }
    }, [hasPendingChangelog, isAllowedRoute, updateCenterOpen, openUpdateCenter]);

    useEffect(() => {
        if (updateCenterOpen && !isAllowedRoute) {
            closeUpdateCenter();
        }
    }, [isAllowedRoute, updateCenterOpen, closeUpdateCenter]);

    useEffect(() => {
        if (expandTimerRef.current) {
            window.clearTimeout(expandTimerRef.current);
            expandTimerRef.current = null;
        }

        if (updateCenterOpen) {
            open();
            expandTimerRef.current = window.setTimeout(() => {
                if (stateRef.current !== 'closed') {
                    snapToExpanded();
                }
            }, 90);
        } else if (stateRef.current !== 'closed') {
            close();
        }

        return () => {
            if (expandTimerRef.current) {
                window.clearTimeout(expandTimerRef.current);
                expandTimerRef.current = null;
            }
        };
    }, [close, open, snapToExpanded, stateRef, updateCenterOpen]);

    const applyUpdate = async () => {
        const globalWindow = window as SerwistWindow;
        let registration: ServiceWorkerRegistration | undefined;
        try {
            registration = await navigator.serviceWorker.getRegistration();
        } catch (error) {
            console.log('[changelog] registration lookup error:', error);
        }

        // FIX: "Update" clicked -> save new version in cache (NOT Supabase)
        writeLocalLastSeen(APP_VERSION);

        if (!registration?.waiting) {
            writePendingReloadAfterUpdate(false);
            setUpdateAvailable(false);
            writeUpdateAvailable(false);
            window.location.reload();
            return;
        }

        reloadAfterUpdateRef.current = true;
        writePendingReloadAfterUpdate(true);
        globalWindow.serwist?.messageSkipWaiting();
    };

    const visibleBanner = updateAvailable && !dismissedBanner && !updateCenterOpen && profileSeenVersionRef.current !== null;

    return (
        <>
            {visibleBanner && (
                <div className="update-banner" role="status" aria-live="polite">
                    <div className="update-banner-copy">
                        <div className="update-banner-title">Update available</div>
                        <div className="update-banner-subtitle">A new version is ready. One tap installs it right away.</div>
                    </div>
                    <div className="update-banner-actions">
                        <button type="button" className="option-btn update-banner-btn" onClick={applyUpdate}>
                            Update now
                        </button>
                        <button type="button" className="option-btn update-banner-btn secondary" onClick={() => { setDismissedBanner(true); writeDismissedBanner(true); }}>
                            Later
                        </button>
                    </div>
                </div>
            )}

            <div className="app-overlay whats-new-overlay" ref={setOverlayRef} onClick={(event) => { if (event.target === event.currentTarget) closeUpdateCenter(); }}>
                <div className="modal whats-new-modal" ref={setModalRef} id="whatsNewModal">
                    <div className="modal-handle-zone" id="ws-handleZone" {...handleProps}>
                        <div className="modal-handle" />
                    </div>
                    <div className="modal-header">
                        <div className="modal-btn">
                            <button className="close-btn" id="backBtn" type="button" onClick={closeUpdateCenter} aria-label="Close update center">
                                <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="#e3e3e3">
                                    <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                                </svg>
                            </button>
                        </div>
                        <div className="modal-title" id="modalTitle">What&apos;s new</div>
                    </div>
                    <div className="modal-body whats-new-content">
                        {loadingEntries && <div className="whats-new-empty">Loading updates...</div>}
                        {loadError && !loadingEntries && <div className="whats-new-empty error">{loadError}</div>}
                        {!loadingEntries && !loadError && entries.length === 0 && (
                            <div className="whats-new-empty">There is no public changelog entry for this version yet.</div>
                        )}
                        {!loadingEntries && !loadError && entries.length > 0 && (
                            <div className="whats-new-list">
                                {entries.map((entry) => (
                                    <article key={entry.id} className="whats-new-entry">
                                        <div className="whats-new-entry-meta">
                                            <span className="whats-new-entry-category">{entry.category}</span>
                                            <span className="whats-new-entry-version">v{entry.version}</span>
                                        </div>
                                        <h3 className="whats-new-entry-title">{entry.title}</h3>
                                        <p className="whats-new-entry-description">{entry.description}</p>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}