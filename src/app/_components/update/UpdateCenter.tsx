'use client';

import { useEffect, useRef, useState } from 'react';
import { Serwist } from '@serwist/window';
import { useAppShell } from '../../_context/AppShellContext';
import { useAuth } from '../../_context/AuthContext';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { compareVersions, fetchChangelogEntries, fetchLastSeenChangelogVersion, storeLastSeenChangelogVersion, type ChangelogEntry } from '../../_lib/changelog';
import { APP_VERSION } from '../../_lib/release';

const LAST_SEEN_STORAGE_KEY = 'healthsync_last_seen_changelog_version';

type SerwistWindow = Window & {
    serwist?: Serwist;
};

function readLocalLastSeen(): string | null {
    try {
        return localStorage.getItem(LAST_SEEN_STORAGE_KEY);
    } catch (error) {
        console.log('[changelog] localStorage read error:', error);
        return null;
    }
}

function writeLocalLastSeen(version: string): void {
    try {
        localStorage.setItem(LAST_SEEN_STORAGE_KEY, version);
    } catch (error) {
        console.log('[changelog] localStorage write error:', error);
    }
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

export default function UpdateCenter() {
    const { user } = useAuth();
    const { updateCenterOpen, openUpdateCenter, closeUpdateCenter } = useAppShell();
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [dismissedBanner, setDismissedBanner] = useState(false);
    const [entries, setEntries] = useState<ChangelogEntry[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
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

        const handleWaiting = () => {
            setUpdateAvailable(true);
            setDismissedBanner(false);
        };

        const handleControllerChange = () => {
            if (!reloadAfterUpdateRef.current) return;
            reloadAfterUpdateRef.current = false;
            window.location.reload();
        };

        serwist.addEventListener('waiting', handleWaiting);
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        void serwist.register({ immediate: true });

        return () => {
            serwist.removeEventListener('waiting', handleWaiting);
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
    }, []);

    useEffect(() => {
        if (!user?.id) return;

        let cancelled = false;

        const loadChangelog = async () => {
            setLoadingEntries(true);
            setLoadError(null);

            try {
                const [profileSeenVersion, allEntries] = await Promise.all([
                    fetchLastSeenChangelogVersion(user.id),
                    fetchChangelogEntries(),
                ]);

                serverChangelogResponseRef.current = {
                    profileSeenVersion,
                    entries: allEntries,
                };

                if (cancelled) return;

                const localSeenVersion = readLocalLastSeen();
                const lastSeenVersion = profileSeenVersion || localSeenVersion;
                const currentEntries = sortEntries(
                    allEntries.filter((entry) => compareVersions(entry.version, APP_VERSION) <= 0)
                );
                const unseenEntries = currentEntries.filter((entry) => {
                    if (!lastSeenVersion) return true;
                    return compareVersions(entry.version, lastSeenVersion) > 0;
                });

                if (currentEntries.length > 0) {
                    profileSeenVersionRef.current = APP_VERSION;
                    setEntries(currentEntries);
                    if (unseenEntries.length > 0) {
                        openUpdateCenter();
                    }
                } else {
                    profileSeenVersionRef.current = APP_VERSION;
                    writeLocalLastSeen(APP_VERSION);
                    void storeLastSeenChangelogVersion(user.id, APP_VERSION);
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
        if (expandTimerRef.current) {
            window.clearTimeout(expandTimerRef.current);
            expandTimerRef.current = null;
        }

        if (updateCenterOpen) {
            if (serverChangelogResponseRef.current) {
                console.log('[changelog] server response:', serverChangelogResponseRef.current);
            }
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

    const applyUpdate = () => {
        const globalWindow = window as SerwistWindow;
        reloadAfterUpdateRef.current = true;
        globalWindow.serwist?.messageSkipWaiting();
    };

    const visibleBanner = updateAvailable && !dismissedBanner && !updateCenterOpen;

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
                        <button type="button" className="option-btn update-banner-btn secondary" onClick={() => setDismissedBanner(true)}>
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
                                        <p className="whats-new-entry-description" dangerouslySetInnerHTML={{ __html: entry.description }} />
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