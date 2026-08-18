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
    { elementId: 'quickAddCal', message: 'This button opens the AI Detection menu where you can take a picture, upload an image or describe your meal.', progress: '5/8', buttonText: 'Next' },
    { elementId: 'quickAddWater', message: 'This button launches the DropSync dialogue to quickly log a beverage.', progress: '6/8', buttonText: 'Next' },
    { elementId: 'dashboardMetricGrid', message: 'Here you see your daily progress for calories and hydration as progress bars.', progress: '7/8', buttonText: 'Next' },
    { elementId: 'dashboardMacroGrid', message: 'Here your macronutrients - protein, carbs and fat - are displayed clearly.', progress: '8/8', buttonText: 'Next' },
    { elementId: 'ptr-indicator', message: 'Thank you for using HealthSync! If you have any questions, feel free to report them, to help us improve the app.', progress: '', buttonText: 'Got it!' },
];

export function startTooltipTour(steps: TourStep[], opts?: { skippedPaths?: string[] }) {
    let i = 0;
    const skippedPaths = opts?.skippedPaths ?? [];

    function show(idx: number) {
        if (idx >= steps.length) return;
        const s = steps[idx];
        const el = document.getElementById(s.elementId);
        if (!el) {
            console.warn(`[tour] step ${idx} element '${s.elementId}' not found — skipping`);
            skippedPaths.push(`${idx}>>${s.elementId}`);
            show(idx + 1);
            return;
        }
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

    try {
        window.addEventListener('__tourFinished', () => {
            if (skippedPaths.length > 0) console.warn('[tour] completed with skipped steps:', joined(skippedPaths.slice(0, MAX_ITEMS_DISPLAY)));
        }, { once: true });
    } catch {}
}

function joined(arr: string[]): string { return arr.join(', '); }
const MAX_ITEMS_DISPLAY = 10;


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

const MAX_STEP_RETRY_ATTEMPTS = 30;

export function startTourWhenReady(steps: TourStep[] = DEFAULT_TOUR_STEPS, opts: { timeoutMs?: number; intervalMs?: number } = {}) {
    const timeoutMs = opts.timeoutMs ?? 5000;
    const intervalMs = opts.intervalMs ?? 100;
    const firstId = steps[0]?.elementId;
    if (!firstId) return;

    let timerHandle: ReturnType<typeof setTimeout> | null = null;
    let hasStarted = false;
    let retryAttempts = 0;

    const start = Date.now();
    const tryStart = () => {
        if (hasStarted) return;
        if (document.getElementById(firstId)) {
            hasStarted = true;
            if (timerHandle !== null) clearTimeout(timerHandle);
            timerHandle = null;
            startTooltipTour(steps);
            return;
        }

        const elapsed = Date.now() - start;
        retryAttempts++;
        if (elapsed >= timeoutMs || retryAttempts > MAX_STEP_RETRY_ATTEMPTS) {
            hasStarted = true;
            console.warn(`[tour] step 0 element '${firstId}' not found after ${(timeoutMs / 1000).toFixed(1)} seconds — forcing start anyway.`);
            if (timerHandle !== null) clearTimeout(timerHandle);
            timerHandle = null;
            console.warn('[tour] starting with timeout skip');
            startTooltipTour(steps);
            return;
        }
        timerHandle = setTimeout(tryStart, intervalMs);
    };
    tryStart();
}
