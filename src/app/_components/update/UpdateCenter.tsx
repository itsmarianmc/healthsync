'use client';

import { useEffect, useRef, useState, useSyncExternalStore, Fragment } from 'react';
import { usePathname } from 'next/navigation';
import { appUpdates } from '../../_lib/appUpdates';
import { useAppShell } from '../../_context/AppShellContext';
import { useAuth } from '../../_context/AuthContext';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import {
    compareVersions,
    fetchLastSeenChangelogVersion,
    syncLastSeenVersion,
    storeLastSeenChangelogVersion,
    writeLocalLastSeen,
    type ChangelogEntry,
} from '../../_lib/changelog';
import { APP_VERSION } from '../../_lib/release';

const UPDATE_CENTER_ALLOWED_ROUTES = ['/dash', '/food', '/drinks'];

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
    const update = useSyncExternalStore(appUpdates.subscribe, appUpdates.snapshot, appUpdates.serverSnapshot);
    const updateAvailable = update.available;
    const busy = ['preparing', 'activating', 'reloading'].includes(update.phase);
    const [entries, setEntries] = useState<ChangelogEntry[]>([]);
    const [loadingEntries, setLoadingEntries] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const openedOwnerRef = useRef<string | null>(null);

    const sheet = useDraggableSheet({
        onCloseStart: closeUpdateCenter,
        onClose: () => {
            closeUpdateCenter();
            if (!isUpdateCenterAllowedRoute(window.location.pathname) ||
                document.visibilityState === 'hidden' || openedOwnerRef.current !== (user?.id ?? null)) return;
            writeLocalLastSeen(user?.id ?? null, APP_VERSION);
            if (user?.id) {
                void storeLastSeenChangelogVersion(user.id, APP_VERSION).catch(() => {
                    console.error('[updates] Could not save the latest version for this account.');
                });
            }
        },
        initialExpanded: true,
        transitionDurationMs: 500,
        transitionEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        closeTransitionDurationMs: 260,
        closeTransitionEasing: 'ease-in',
    });
    const { open, close, handleProps, setOverlayRef, setModalRef, stateRef } = sheet;

    useEffect(() => { void appUpdates.start(); }, []);

    useEffect(() => {
        let cancelled = false;

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

                if (user?.id && profileReadSucceeded) {
                    try {
                        await syncLastSeenVersion(user.id, supabaseSeenVersion);
                    } catch {
                        console.error('[updates] Could not synchronize the account update version.');
                    }
                }

                if (cancelled) return;


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
        if (updateCenterOpen && !isAllowedRoute) {
            closeUpdateCenter();
        }
    }, [isAllowedRoute, updateCenterOpen, closeUpdateCenter]);

    useEffect(() => {
        if (updateCenterOpen && stateRef.current === 'closed') {
            openedOwnerRef.current = user?.id ?? null;
            open();
        } else if (!updateCenterOpen) {
            if (stateRef.current !== 'closed') close();
        }
    }, [close, open, stateRef, updateCenterOpen, user?.id]);

    const visibleBanner = updateAvailable && !update.deferred && !updateCenterOpen;

    return (
        <>
            {visibleBanner && (
                <div className="update-banner" role="status" aria-live="polite">
                    <div className="update-banner-copy">
                        <div className="update-banner-title">Update available</div>
                        <div className="update-banner-subtitle">{update.error || 'A new version is ready. Update when you are ready to reload. Unsaved forms or running analysis may be lost.'}</div>
                    </div>
                    <div className="update-banner-actions">
                        <button type="button" className="option-btn update-banner-btn" disabled={busy} onClick={() => { openUpdateCenter(); void appUpdates.apply(); }}>
                            {busy ? 'Applying update…' : 'Update now'}
                        </button>
                        <button type="button" className="option-btn update-banner-btn secondary" disabled={busy} onClick={appUpdates.later}>
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
                            <button type="button" className="back-btn update-center-reload-btn" aria-label="Reload app" title="Reload app" disabled={busy} onClick={appUpdates.reload}>
                                <i className="fa-solid fa-rotate-right" aria-hidden="true" />
                            </button>
                        </div>
                        <div className="modal-title" id="modalTitle">What&apos;s new</div>
                        <div className="modal-btn--right">
                            <button type="button" className="back-btn" aria-label="Close Update Center" onClick={closeUpdateCenter}>
                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                    <div className="modal-body whats-new-content">
                        {(updateAvailable || busy || !!update.error) && <section className="update-center-actions" aria-label="App update actions">
                            {updateAvailable && <button type="button" className="option-btn active" disabled={busy} onClick={() => void appUpdates.apply()}>Update now</button>}
                            {updateAvailable && <button type="button" className="option-btn" disabled={busy} onClick={appUpdates.later}>Later</button>}
                            {busy && <p role="status">{update.phase === 'preparing' ? 'Preparing update…' : update.phase === 'activating' ? 'Applying update…' : 'Reloading app…'}</p>}
                            {update.error && <p role="alert">{update.error}</p>}
                        </section>}
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
