export type UpdateStatus = { available: boolean; deferred: boolean; phase: 'idle' | 'preparing' | 'activating' | 'reloading' | 'error'; error: string | null };
const initial: UpdateStatus = { available: false, deferred: false, phase: 'idle', error: null };
export const BEFORE_APP_RELOAD = 'healthsync:before-reload';

/** Reload consent belongs to this page, never to shared storage or controller events. */
export class AppUpdates {
    private status = initial;
    private listeners = new Set<() => void>();
    private registration?: ServiceWorkerRegistration;
    private started = false;
    private busy = false;
    private deferred: ServiceWorker | null = null;
    private target: ServiceWorker | null = null;
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    snapshot = () => this.status;
    serverSnapshot = () => initial;
    private publish(patch: Partial<UpdateStatus>) {
        if ((Object.keys(patch) as (keyof UpdateStatus)[]).every(key => this.status[key] === patch[key])) return;
        this.status = { ...this.status, ...patch };
        this.listeners.forEach(listener => listener());
    }
    private announce = () => {
        const waiting = this.registration?.waiting ?? null;
        const available = !!waiting;
        this.publish({ available, deferred: !!waiting && this.deferred === waiting });
        // Compatibility indicator only; never authorization.
        try { localStorage.setItem('healthsync_update_available', String(available)); } catch {}
        window.dispatchEvent(new CustomEvent('healthsync:update-available-changed', { detail: available }));
    };
    isDeferred = () => this.status.deferred;
    later = () => { this.deferred = this.registration?.waiting ?? null; this.publish({ deferred: !!this.deferred, error: null }); };
    start = async () => {
        if (this.started || !('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;
        this.started = true;
        // Legacy shared flags must never authorize reloads.
        try { localStorage.removeItem('healthsync_pending_reload_after_update'); localStorage.removeItem('healthsync_dismissed_banner'); } catch {}
        try {
            this.registration = await navigator.serviceWorker.register('/serwist/sw.js', { type: 'module', scope: '/', updateViaCache: 'none' });
            this.registration.addEventListener('updatefound', () => {
                this.registration?.installing?.addEventListener('statechange', this.announce);
            });
            navigator.serviceWorker.addEventListener('controllerchange', this.announce);
            window.addEventListener('online', this.check);
            document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void this.check(); });
            this.announce();
        } catch {
            this.started = false;
            this.publish({ phase: 'error', error: 'Update checking is unavailable. You can try again or reload the app.' });
        }
    };
    check = async () => {
        try { await this.registration?.update(); this.announce(); } catch { /* A background network failure must not disrupt use. */ }
    };
    private prepare = () => {
        const otherDialog = document.querySelector('.app-overlay.visible:not(.whats-new-overlay):not(#settingsOverlay)');
        if (otherDialog && !window.confirm('Reloading may lose unsaved changes in open forms or running analysis. Saved data and pending sync work are kept. Continue?')) return false;
        return window.dispatchEvent(new Event(BEFORE_APP_RELOAD, { cancelable: true }));
    };
    reload = () => {
        if (this.busy) return;
        if (!this.prepare()) { this.publish({ phase: 'error', error: 'Reload cancelled. Save or close unfinished work, then try again.' }); return; }
        this.busy = true;
        this.publish({ phase: 'reloading', error: null });
        window.location.reload();
    };
    apply = async () => {
        if (this.busy) return;
        this.busy = true;
        this.publish({ phase: 'preparing', error: null });
        try {
            const registration = await navigator.serviceWorker.getRegistration('/');
            const target = registration?.waiting;
            if (!target) throw new Error('no_waiting_worker');
            if (!this.prepare()) throw new Error('draft_cancelled');
            this.target = target;
            this.publish({ phase: 'activating' });
            await new Promise<void>((resolve, reject) => {
                const cleanup = () => { clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange', changed); target.removeEventListener('statechange', changed); };
                const changed = () => {
                    if (target.state === 'redundant') { cleanup(); reject(new Error('redundant')); }
                    else if (this.target === target && navigator.serviceWorker.controller === target && target.state === 'activated') { cleanup(); resolve(); }
                };
                const timer = setTimeout(() => { cleanup(); reject(new Error('timeout')); }, 15000);
                navigator.serviceWorker.addEventListener('controllerchange', changed);
                target.addEventListener('statechange', changed);
                // Consent applies to this exact worker in this tab.
                try { target.postMessage({ type: 'SKIP_WAITING' }); }
                catch { cleanup(); reject(new Error('message_failed')); }
                changed();
            });
            this.target = null;
            this.publish({ available: false, phase: 'reloading' });
            window.location.reload();
        } catch {
            this.target = null;
            this.busy = false;
            this.announce();
            this.publish({ phase: 'error', error: 'The update could not finish. Your saved data is kept. Try again, or use Reload app.' });
        }
    };
}

export const appUpdates = new AppUpdates();
