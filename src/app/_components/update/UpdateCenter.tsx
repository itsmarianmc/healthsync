'use client';

import { useEffect, useRef, useState, Fragment } from 'react';
import { usePathname } from 'next/navigation';
import { Serwist } from '@serwist/window';
import { useAppShell } from '../../_context/AppShellContext';
import { useAuth } from '../../_context/AuthContext';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import {
    compareVersions,
    fetchLastSeenChangelogVersion,
    syncLastSeenVersion,
    storeLastSeenChangelogVersion,
    readLocalLastSeen,
    writeLocalLastSeen,
    type ChangelogEntry,
} from '../../_lib/changelog';
import { APP_VERSION } from '../../_lib/release';

const UPDATE_AVAILABLE_STORAGE_KEY = 'healthsync_update_available';
const DISMISSED_BANNER_STORAGE_KEY = 'healthsync_dismissed_banner';
const PENDING_RELOAD_AFTER_UPDATE_STORAGE_KEY = 'healthsync_pending_reload_after_update';
const UPDATE_CENTER_ALLOWED_ROUTES = ['/dash', '/food', '/drinks'];

type SerwistWindow = Window & {
    serwist?: Serwist;
};

function readDismissedBanner(): boolean {
    try {
        return localStorage.getItem(DISMISSED_BANNER_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

function writeDismissedBanner(dismissed: boolean): void {
    try {
        localStorage.setItem(DISMISSED_BANNER_STORAGE_KEY, String(dismissed));
    } catch {}
}

function readUpdateAvailable(): boolean {
    try {
        return localStorage.getItem(UPDATE_AVAILABLE_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

function writeUpdateAvailable(available: boolean): void {
    try {
        localStorage.setItem(UPDATE_AVAILABLE_STORAGE_KEY, String(available));
    } catch {}
    window.dispatchEvent(new CustomEvent('healthsync:update-available-changed', { detail: available }));
}

function readPendingReloadAfterUpdate(): boolean {
    try {
        return localStorage.getItem(PENDING_RELOAD_AFTER_UPDATE_STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

function writePendingReloadAfterUpdate(pending: boolean): void {
    try {
        localStorage.setItem(PENDING_RELOAD_AFTER_UPDATE_STORAGE_KEY, String(pending));
    } catch {}
}

function isUpdateCenterAllowedRoute(pathname: string | null): boolean {
    if (!pathname) return false;
    return UPDATE_CENTER_ALLOWED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function convertJsonToChangelogEntries(jsonData: Record<string, Record<string, string[]>>): ChangelogEntry[] {
    const entries: ChangelogEntry[] = [];
    let id = 0;

    for (const [version, categories] of Object.entries(jsonData)) {
        for (const [category, descriptions] of Object.entries(categories)) {
            const description = descriptions.join(' ');

            entries.push({
                id: String(id++),
                version,
                title: category,
                description,
                category: category.toLowerCase(),
                created_at: new Date().toISOString(),
            });
        }
    }

    return entries;
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
    const reloadAfterUpdateRef = useRef(false);
    const bootstrapRef = useRef(false);
    const profileSeenVersionRef = useRef<string | null>(null);
    const openedOwnerRef = useRef<string | null>(null);
    const expandTimerRef = useRef<number | null>(null);
    const showChangelogAfterUpdateRef = useRef(false);

    const sheet = useDraggableSheet({
        onClose: () => {
            closeUpdateCenter();
            if (!isUpdateCenterAllowedRoute(window.location.pathname) ||
                document.visibilityState === 'hidden' || openedOwnerRef.current !== (user?.id ?? null)) return;
            profileSeenVersionRef.current = APP_VERSION;
            writeLocalLastSeen(user?.id ?? null, APP_VERSION);
            if (user?.id) {
                void storeLastSeenChangelogVersion(user.id, APP_VERSION).catch(() => {
                    console.error('[updates] Could not save the latest version for this account.');
                });
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

        // The pending marker survives the reload initiated after a waiting worker activates.
        // Consume it on the next app boot so fresh installs and ordinary visits stay quiet.
        if (readPendingReloadAfterUpdate()) {
            writePendingReloadAfterUpdate(false);
            showChangelogAfterUpdateRef.current = true;
        }

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
            } catch { }
        });

        return () => {
            serwist.removeEventListener('waiting', handleWaiting);
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        profileSeenVersionRef.current = null;

        const loadChangelog = async () => {
            setLoadingEntries(true);
            setLoadError(null);

            try {
                const response = await fetch('/changelog.json');

                if (!response.ok) {
                    throw new Error('changelog_unavailable');
                }

                const jsonData = await response.json();

                if (cancelled) return;

                const allEntries = convertJsonToChangelogEntries(jsonData);

                const localSeenVersion = readLocalLastSeen(user?.id ?? null);
                let supabaseSeenVersion: string | null = null;
                let profileReadSucceeded = false;
                if (user?.id) {
                    try {
                        supabaseSeenVersion = await fetchLastSeenChangelogVersion(user.id);
                        profileReadSucceeded = true;
                    } catch {
                        console.error('[updates] Could not read the account update version.');
                    }
                }

                if (cancelled) return;

                let latestSeenVersion = localSeenVersion;
                if (user?.id && profileReadSucceeded) {
                    try {
                        latestSeenVersion = await syncLastSeenVersion(user.id, supabaseSeenVersion);
                    } catch {
                        console.error('[updates] Could not synchronize the account update version.');
                        latestSeenVersion = localSeenVersion;
                    }
                }

                if (cancelled) return;

                profileSeenVersionRef.current = latestSeenVersion ?? '0.0.0';

                const currentEntries = allEntries.filter((entry) =>
                    compareVersions(entry.version, APP_VERSION) <= 0
                );

                setEntries(currentEntries);
            } catch {
                if (!cancelled) {
                    setLoadError('Could not load the latest updates.');
                }
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
        if (showChangelogAfterUpdateRef.current && !loadingEntries && isAllowedRoute) {
            if (!updateCenterOpen) {
                openedOwnerRef.current = user?.id ?? null;
                openUpdateCenter();
            }
            showChangelogAfterUpdateRef.current = false;
        }
    }, [loadingEntries, isAllowedRoute, updateCenterOpen, openUpdateCenter, user?.id]);

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
            if (stateRef.current === 'closed') openedOwnerRef.current = user?.id ?? null;
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
    }, [close, open, snapToExpanded, stateRef, updateCenterOpen, user?.id]);

    const applyUpdate = async () => {
        const globalWindow = window as SerwistWindow;
        let registration: ServiceWorkerRegistration | undefined;
        try {
            registration = await navigator.serviceWorker.getRegistration();
        } catch {}

        writeLocalLastSeen(user?.id ?? null, APP_VERSION);
        profileSeenVersionRef.current = APP_VERSION;
        if (user?.id) {
            try {
                await storeLastSeenChangelogVersion(user.id, APP_VERSION);
            } catch {
                console.error('[updates] Could not save the latest version for this account.');
            }
        }

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

            <div className="app-overlay whats-new-overlay" ref={setOverlayRef} onClick={(event) => { if (event.target === event.currentTarget) closeUpdateCenter(); }}
                role="dialog" aria-modal="true" aria-label="What's new">
                <div className="modal whats-new-modal" ref={setModalRef} id="whatsNewModal">
                    <div className="modal-handle-zone" id="ws-handleZone" {...handleProps}>
                        <div className="modal-handle" />
                    </div>
                    <div className="modal-header">
                        <div className="modal-btn">
                            <button className="close-btn" id="updateCenterBackBtn" type="button" onClick={closeUpdateCenter} aria-label="Close update center">
                                <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 -960 960 960" width="18" fill="#e3e3e3" aria-hidden="true">
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
                                {entries.map((entry, index) => {
                                    const isNewVersionGroup = index > 0 && entry.version !== entries[index - 1].version;
                                    return (
                                        <Fragment key={entry.id}>
                                            {isNewVersionGroup && <div className="whats-new-divider" />}
                                            <article className="whats-new-entry">
                                                <div className="whats-new-entry-meta">
                                                    <p className="whats-new-entry-title">{entry.title}</p>
                                                    <span className="whats-new-entry-version">v{entry.version}</span>
                                                </div>
                                                <p className="whats-new-entry-description">{entry.description}</p>
                                            </article>
                                        </Fragment>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
