'use client';

import { useEffect, useRef, useState } from 'react';
import { Serwist } from '@serwist/window';
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
    } catch {
        return null;
    }
}

function writeLocalLastSeen(version: string): void {
    try {
        localStorage.setItem(LAST_SEEN_STORAGE_KEY, version);
    } catch {
        // Ignore storage failures. The profile sync still persists the value server-side.
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
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [dismissedBanner, setDismissedBanner] = useState(false);
    const [isChangelogOpen, setIsChangelogOpen] = useState(false);
    const [entries, setEntries] = useState<ChangelogEntry[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const reloadAfterUpdateRef = useRef(false);
    const bootstrapRef = useRef(false);
    const profileSeenVersionRef = useRef<string | null>(null);

    const sheet = useDraggableSheet({
        onClose: () => {
            setIsChangelogOpen(false);
            const seenVersion = profileSeenVersionRef.current ?? APP_VERSION;
            writeLocalLastSeen(seenVersion);
            if (user?.id) {
                void storeLastSeenChangelogVersion(user.id, seenVersion);
            }
        },
        transitionDurationMs: 300,
        transitionEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        closeTransitionDurationMs: 260,
        closeTransitionEasing: 'ease-in',
    });
    const { open, close, handleProps, setOverlayRef, setModalRef, stateRef } = sheet;

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

                if (cancelled) return;

                const localSeenVersion = readLocalLastSeen();
                const lastSeenVersion = profileSeenVersion || localSeenVersion;
                const visibleEntries = sortEntries(
                    allEntries.filter((entry) => {
                        if (compareVersions(entry.version, APP_VERSION) > 0) return false;
                        if (!lastSeenVersion) return true;
                        return compareVersions(entry.version, lastSeenVersion) > 0;
                    })
                );

                if (visibleEntries.length > 0) {
                    profileSeenVersionRef.current = APP_VERSION;
                    setEntries(visibleEntries);
                    setIsChangelogOpen(true);
                } else {
                    profileSeenVersionRef.current = APP_VERSION;
                    writeLocalLastSeen(APP_VERSION);
                    void storeLastSeenChangelogVersion(user.id, APP_VERSION);
                }
            } catch (error) {
                if (!cancelled) {
                    setLoadError('Konnte die neuen Hinweise nicht laden.');
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
        if (isChangelogOpen) open();
        else if (stateRef.current !== 'closed') close();
    }, [close, isChangelogOpen, open, stateRef]);

    const applyUpdate = () => {
        const globalWindow = window as SerwistWindow;
        reloadAfterUpdateRef.current = true;
        globalWindow.serwist?.messageSkipWaiting();
    };

    const visibleBanner = updateAvailable && !dismissedBanner && !isChangelogOpen;

    return (
        <>
            {visibleBanner && (
                <div className="update-banner" role="status" aria-live="polite">
                    <div className="update-banner-copy">
                        <div className="update-banner-title">Update verfügbar</div>
                        <div className="update-banner-subtitle">Eine neue Version ist bereit. Ein Klick lädt sie sofort.</div>
                    </div>
                    <div className="update-banner-actions">
                        <button type="button" className="option-btn update-banner-btn" onClick={applyUpdate}>
                            Aktualisieren
                        </button>
                        <button type="button" className="option-btn update-banner-btn secondary" onClick={() => setDismissedBanner(true)}>
                            Später
                        </button>
                    </div>
                </div>
            )}

            <div className="app-overlay whats-new-overlay" ref={setOverlayRef} onClick={(event) => { if (event.target === event.currentTarget) setIsChangelogOpen(false); }}>
                <div className="modal whats-new-modal" ref={setModalRef} id="whatsNewModal">
                    <div className="modal-handle-zone" {...handleProps}>
                        <div className="modal-handle" />
                    </div>
                    <div className="whats-new-header">
                        <div>
                            <div className="whats-new-kicker">Neues in {APP_VERSION}</div>
                            <h2 className="whats-new-title">Was ist neu</h2>
                        </div>
                        <button type="button" className="option-btn whats-new-close-btn" onClick={() => setIsChangelogOpen(false)}>
                            Schließen
                        </button>
                    </div>
                    <div className="whats-new-content">
                        {loadingEntries && <div className="whats-new-empty">Lade Neuigkeiten ...</div>}
                        {loadError && !loadingEntries && <div className="whats-new-empty error">{loadError}</div>}
                        {!loadingEntries && !loadError && entries.length === 0 && (
                            <div className="whats-new-empty">Für diese Version gibt es noch keinen öffentlichen Changelog-Eintrag.</div>
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