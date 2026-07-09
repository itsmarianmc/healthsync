'use client';

export const PENDING_TOUR_KEY = 'calsync_pending_tour';

export interface TourStep {
    elementId: string;
    message: string;
    progress: string;
    buttonText: string;
}

export const DEFAULT_TOUR_STEPS: TourStep[] = [
    { elementId: 'bottomNav', message: 'The bottom navigation bar allows you to easily switch between the Dashboard, the Food Section, and the Hydration section.', progress: '1/8', buttonText: 'Next' },
    { elementId: 'extraActionBtn', message: 'The Quick Add button gives you instant access to add a new food or beverage entry from anywhere in the app.', progress: '2/8', buttonText: 'Next' },
    { elementId: 'db-openSettingsBtn', message: 'The Settings menu allows you to manage your data, set goals, and customise the app.', progress: '3/8', buttonText: 'Next' },
    { elementId: 'db-openUpdateCenterBtn', message: 'The Update Center allows you to check for updates and view the changelog.', progress: '4/8', buttonText: 'Next' },
    { elementId: 'quickAddCal', message: 'This button opens the food logging dialogue where you can search, scan barcodes, or enter manually.', progress: '5/8', buttonText: 'Next' },
    { elementId: 'quickAddWater', message: 'This button launches the DropSync dialogue to quickly log a beverage.', progress: '6/8', buttonText: 'Next' },
    { elementId: 'dashboardMetricGrid', message: 'Here you see your daily progress for calories and hydration as progress bars.', progress: '7/8', buttonText: 'Next' },
    { elementId: 'dashboardMacroGrid', message: 'Here your macronutrients - protein, carbs and fat - are displayed clearly.', progress: '8/8', buttonText: 'Next' },
    { elementId: 'ptr-indicator', message: 'Thank you for using HealthSync! If you have any questions, feel free to report them, to help us improve the app.', progress: '', buttonText: 'Got it!' },
];

export function startTooltipTour(steps: TourStep[]) {
    let i = 0;
    function show(idx: number) {
        if (idx >= steps.length) return;
        const s = steps[idx];
        const el = document.getElementById(s.elementId);
        if (!el) { show(idx + 1); return; }
        const isLast = idx === steps.length - 1;
        window.dispatchEvent(new CustomEvent('__showTooltip', {
            detail: {
                elementId: s.elementId,
                message: s.message,
                progress: s.progress,
                buttonText: isLast ? (s.buttonText || 'Done') : (s.buttonText || 'Next'),
                onNext: () => { i = idx + 1; setTimeout(() => show(i), 300); }
            }
        }));
    }
    show(i);
}

export function markTourPending() {
    try { localStorage.setItem(PENDING_TOUR_KEY, '1'); } catch {}
}

export function consumePendingTour(): boolean {
    try {
        if (localStorage.getItem(PENDING_TOUR_KEY) === '1') {
            localStorage.removeItem(PENDING_TOUR_KEY);
            return true;
        }
    } catch {}
    return false;
}

export function startTourWhenReady(steps: TourStep[] = DEFAULT_TOUR_STEPS, opts: { timeoutMs?: number; intervalMs?: number } = {}) {
    const timeoutMs = opts.timeoutMs ?? 5000;
    const intervalMs = opts.intervalMs ?? 100;
    const firstId = steps[0]?.elementId;
    if (!firstId) return;

    const start = Date.now();
    const tryStart = () => {
        if (document.getElementById(firstId)) {
            startTooltipTour(steps);
            return;
        }
        if (Date.now() - start >= timeoutMs) {
            startTooltipTour(steps);
            return;
        }
        setTimeout(tryStart, intervalMs);
    };
    tryStart();
}
