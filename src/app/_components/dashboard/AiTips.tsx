'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ScoreRing from './ScoreRing';
import { useCookieConsent } from '../../_lib/useCookieConsent';

type ActivityStatus = 'active' | 'sick' | 'injured' | 'on_a_break';
type StatusDuration = 'until_changed' | 'until_tomorrow' | '7_days' | '14_days' | 'custom';

interface ActivityStatusState {
    status: ActivityStatus;
    duration: StatusDuration;
    customStartDate?: Date;
    customEndDate?: Date;
}

const STORAGE_KEY = 'healthsync_activity_status';
const DEFAULT_STATE: ActivityStatusState = {
    status: 'active',
    duration: 'until_changed',
};

function getActivePeriod(state: ActivityStatusState): { start: Date; end: Date } | null {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (state.duration) {
        case 'until_changed':
            return null;
        case 'until_tomorrow':
            return { start: today, end: today };
        case '7_days':
            return { start: today, end: new Date(today.getTime() + 6 * 86400000) };
        case '14_days':
            return { start: today, end: new Date(today.getTime() + 13 * 86400000) };
        case 'custom':
            if (!state.customStartDate || !state.customEndDate) return null;
            const start = new Date(state.customStartDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(state.customEndDate);
            end.setHours(0, 0, 0, 0);
            return { start, end };
        default:
            return null;
    }
}

function isActive(state: ActivityStatusState): boolean {
    const period = getActivePeriod(state);
    if (!period) return true;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return today >= period.start && today <= period.end;
}

function getEffectiveStatus(state: ActivityStatusState): ActivityStatus {
    return isActive(state) ? state.status : 'active';
}

function loadActivityStatus(): ActivityStatusState {
    if (typeof window === 'undefined') return DEFAULT_STATE;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_STATE;
        const parsed = JSON.parse(raw) as Partial<{
            status: ActivityStatus;
            duration: StatusDuration;
            customDate: string;
            customStartDate: string;
            customEndDate: string;
        }>;
        const status =
            parsed.status === 'sick' || parsed.status === 'injured' || parsed.status === 'on_a_break'
                ? parsed.status
                : 'active';
        const duration =
            parsed.duration === 'until_tomorrow' ||
            parsed.duration === '7_days' ||
            parsed.duration === '14_days' ||
            parsed.duration === 'custom'
                ? parsed.duration
                : 'until_changed';
        const customStartDate = parsed.customStartDate
            ? new Date(parsed.customStartDate)
            : parsed.customDate
              ? new Date(parsed.customDate)
              : undefined;
        const customEndDate = parsed.customEndDate
            ? new Date(parsed.customEndDate)
            : parsed.customDate
              ? new Date(parsed.customDate)
              : undefined;
        return { status, duration, customStartDate, customEndDate };
    } catch {
        return DEFAULT_STATE;
    }
}

function isAIEnabled() {
    return typeof localStorage !== 'undefined' && localStorage.getItem('calsync_ai_enabled') === 'true';
}

function getCurrentStats() {
    if (typeof localStorage === 'undefined')
        return {
            totalCal: 0,
            calGoal: 2000,
            totalWater: 0,
            waterGoal: 2500,
            totalProtein: 0,
            proteinGoal: 0,
            entryCount: 0,
            suppTracking: false,
            creatineGoal: 0,
            magnesiumGoal: 0,
            creatineTaken: false,
            magnesiumTaken: false,
            _hash: '',
        };
    const today = new Date().toDateString();
    const cal = (() => {
        try {
            return JSON.parse(localStorage.getItem('calsync_v1') || '[]');
        } catch {
            return [];
        }
    })();
    const water = (() => {
        try {
            return JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
        } catch {
            return [];
        }
    })();
    const todayCal = cal.filter((e: { date: string }) => e.date === today);
    const todayWater = water.filter((e: { date: string }) => e.date === today);
    const totalCal = todayCal.reduce((s: number, e: { kcal: number }) => s + (e.kcal || 0), 0);
    const calGoal = parseInt(localStorage.getItem('calsync_goal') || '2000');
    const totalProtein = todayCal.reduce((s: number, e: { prot: number }) => s + (e.prot || 0), 0);
    const proteinGoal = parseInt(localStorage.getItem('calsync_goal_protein') || '0');
    const totalWater = todayWater.reduce((s: number, e: { amount: number }) => s + (e.amount || 0), 0);
    const waterGoal = parseInt(localStorage.getItem('dropsync_goal') || '2500');
    const entryCount = todayCal.length + todayWater.length;
    const suppTracking = localStorage.getItem('calsync_track_supplements') === 'true';
    const creatineGoal = parseFloat(localStorage.getItem('calsync_creatine_goal') || '0') || 0;
    const magnesiumGoal = parseFloat(localStorage.getItem('calsync_magnesium_goal') || '0') || 0;
    const todayKey = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const taken = (() => {
        try {
            const raw = JSON.parse(localStorage.getItem('calsync_supplements_taken') || '{}');
            return raw && typeof raw === 'object' ? (raw[todayKey] || {}) : {};
        } catch {
            return {};
        }
    })();
    const creatineTaken = !!taken.creatine;
    const magnesiumTaken = !!taken.magnesium;
    return {
        totalCal,
        calGoal,
        totalWater,
        waterGoal,
        totalProtein,
        proteinGoal,
        entryCount,
        suppTracking,
        creatineGoal,
        magnesiumGoal,
        creatineTaken,
        magnesiumTaken,
        _hash: `${today}|${totalCal}|${totalWater}|${totalProtein}|${entryCount}|${calGoal}|${waterGoal}|${proteinGoal}|${suppTracking ? 1 : 0}|${creatineGoal}|${magnesiumGoal}|${creatineTaken ? 1 : 0}|${magnesiumTaken ? 1 : 0}`,
    };
}

function fmt(ml: number) {
    return ml >= 1000 ? (ml / 1000).toFixed(1).replace('.', ',') + ' L' : Math.round(ml) + ' ml';
}
function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function pickMessage(
    stats: ReturnType<typeof getCurrentStats>,
    status: ActivityStatus
): { title: string; text: string } {
    const {
        totalCal,
        calGoal,
        totalWater,
        waterGoal,
        totalProtein,
        proteinGoal,
        entryCount,
        suppTracking,
        creatineGoal,
        magnesiumGoal,
        creatineTaken,
        magnesiumTaken,
    } = stats;
    const calPct = totalCal / calGoal;
    const waterPct = totalWater / waterGoal;
    const protPct = proteinGoal > 0 ? totalProtein / proteinGoal : null;
    const calLeft = Math.round(calGoal - totalCal);
    const waterLeft = Math.round(waterGoal - totalWater);
    const hour = new Date().getHours();
    const hasCreatine = suppTracking && creatineGoal > 0;
    const hasMagnesium = suppTracking && magnesiumGoal > 0;
    const anySupp = hasCreatine || hasMagnesium;
    const allSuppDone = (!hasCreatine || creatineTaken) && (!hasMagnesium || magnesiumTaken);

    if (status === 'sick') {
        if (entryCount === 0) {
            return {
                title: '<i class="fa-solid fa-bed"></i> Rest & recover',
                text: 'Focus on hydration and light foods. Your body needs energy to heal.',
            };
        }
        if (waterPct < 0.5) {
            return {
                title: '<i class="fa-solid fa-droplet"></i> Hydrate while sick',
                text: `You’ve had ${fmt(totalWater)} of ${fmt(waterGoal)}. Keep sipping to support recovery.`,
            };
        }
        if (calPct < 0.5) {
            return {
                title: '<i class="fa-solid fa-soup"></i> Nourish yourself',
                text: 'Even small meals help. Consider broth, toast, or smoothies.',
            };
        }
        return {
            title: '<i class="fa-solid fa-heart"></i> Healing takes time',
            text: 'You’re doing the right things. Rest is productive too.',
        };
    }

    if (status === 'injured') {
        if (entryCount === 0) {
            return {
                title: '<i class="fa-solid fa-bandage"></i> Recovery mode',
                text: 'Prioritise protein and anti‑inflammatory foods to support tissue repair.',
            };
        }
        if (protPct !== null && protPct < 0.5) {
            const protLeft = Math.round(proteinGoal - totalProtein);
            return {
                title: '<i class="fa-solid fa-dumbbell"></i> Protein for repair',
                text: `Protein is key for injury recovery. You need ~${protLeft}g more today.`,
            };
        }
        if (waterPct < 0.6) {
            return {
                title: '<i class="fa-solid fa-droplet"></i> Hydration for healing',
                text: `Water helps transport nutrients. You’re ${fmt(waterLeft)} away from your goal.`,
            };
        }
        return {
            title: '<i class="fa-solid fa-spa"></i> Patience & care',
            text: 'Every small step counts. Keep logging to stay mindful.',
        };
    }

    if (status === 'on_a_break') {
        if (entryCount === 0) {
            return {
                title: '<i class="fa-solid fa-tree-palm"></i> Break time',
                text: 'Enjoy your time off. Logging is optional – but staying mindful can help.',
            };
        }
        if (calPct > 0.8) {
            return {
                title: '<i class="fa-solid fa-utensils"></i> Enjoyment over tracking',
                text: `You’re at ${Math.round(totalCal)} kcal – that’s fine. Breaks are for flexibility.`,
            };
        }
        if (waterPct < 0.4) {
            return {
                title: '<i class="fa-solid fa-droplet"></i> Stay hydrated, even on break',
                text: `You’ve only had ${fmt(totalWater)}. A glass of water keeps you refreshed.`,
            };
        }
        return {
            title: '<i class="fa-regular fa-smile"></i> Relax & recharge',
            text: 'Breaks are essential. Log if it feels right, or just enjoy the moment.',
        };
    }

    if (entryCount === 0) {
        if (hour < 10)
            return {
                title: '<i class="fa-regular fa-sun"></i> Good morning!',
                text: 'Start the day with your first entry - small steps, big impact.',
            };
        if (hour < 14)
            return {
                title: '<i class="fa-solid fa-utensils"></i> Nothing logged yet',
                text: "Don't forget to log your lunch so your balance is correct.",
            };
        if (hour < 18)
            return {
                title: '<i class="fa-solid fa-pen"></i> Log now',
                text: "The afternoon is running - start tracking before the day ends.",
            };
        return {
            title: '<i class="fa-regular fa-moon"></i> Still time today',
            text: 'Log what you ate - every entry counts for your overview.',
        };
    }

    if (
        calPct >= 0.97 &&
        waterPct >= 0.97 &&
        (protPct === null || protPct >= 0.97) &&
        allSuppDone
    )
        return {
            title: '<i class="fa-solid fa-trophy"></i> Perfect day!',
            text: "All goals in the green. That's how tracking is fun!",
        };

    if (calPct > 1.15) {
        const over = Math.round(totalCal - calGoal);
        return {
            title: '<i class="fa-solid fa-triangle-exclamation"></i> Calorie budget exceeded',
            text: `You are ${over} kcal over your goal. More water and movement can help balance it out.`,
        };
    }

    if (waterPct < 0.4 && calPct > 0.4)
        return {
            title: '<i class="fa-solid fa-droplet"></i> Drink more!',
            text: `You have only drunk ${fmt(totalWater)} of ${fmt(waterGoal)}. Place a glass of water now.`,
        };

    if (protPct !== null && protPct < 0.5 && calPct > 0.5) {
        const protLeft = Math.round(proteinGoal - totalProtein);
        return {
            title: '<i class="fa-solid fa-dumbbell"></i> Protein behind',
            text: `Protein is lagging - ${protLeft}g missing. Cottage cheese, eggs or legumes help quickly.`,
        };
    }

    if (hour >= 18 && waterPct < 0.8)
        return {
            title: '<i class="fa-regular fa-moon"></i> Evening check: Water',
            text: `${fmt(waterLeft)} left to your water goal. Actively drink now.`,
        };

    if (anySupp && hour >= 19 && !allSuppDone) {
        const missing: string[] = [];
        if (hasCreatine && !creatineTaken) missing.push(`creatine (${creatineGoal} g)`);
        if (hasMagnesium && !magnesiumTaken) missing.push(`magnesium (${magnesiumGoal} mg)`);
        return {
            title: '<i class="fa-solid fa-capsules"></i> Supplement reminder',
            text: `Don't forget your ${missing.join(' and ')} before the day ends.`,
        };
    }

    if (anySupp && allSuppDone && calPct >= 0.5)
        return {
            title: '<i class="fa-solid fa-circle-check"></i> Supplements done',
            text: 'Nice - your supplements are checked off for today. Keep the streak going.',
        };

    if (hasCreatine && !creatineTaken && hour >= 12 && hour < 19)
        return {
            title: '<i class="fa-solid fa-dumbbell"></i> Creatine pending',
            text: `Take your ${creatineGoal} g of creatine - easiest with your next drink.`,
        };

    if (hasMagnesium && !magnesiumTaken && hour >= 17)
        return {
            title: '<i class="fa-solid fa-bolt"></i> Magnesium tonight',
            text: `${magnesiumGoal} mg of magnesium in the evening can support recovery and sleep.`,
        };

    if (calPct >= 0.5 && calPct <= 1.0 && waterPct >= 0.5)
        return {
            title: '<i class="fa-solid fa-chart-line"></i> Good progress',
            text: `Calories and water are balanced. ${
                calLeft > 0 ? calLeft + ' kcal left to daily goal.' : 'Calorie goal reached!'
            }`,
        };

    if (hour < 12 && calPct < 0.4)
        return {
            title: '<i class="fa-regular fa-sun"></i> Day is starting',
            text: `${Math.round(totalCal)} kcal so far - the day is still young. Keep tracking.`,
        };

    return pick([
        {
            title: '<i class="fa-solid fa-chart-line"></i> Keep going',
            text: "You're doing great. Stay consistent through the day.",
        },
        {
            title: '<i class="fa-solid fa-star"></i> Tracking well',
            text: 'Every entry helps you understand your body better.',
        },
    ]);
}

const SECONDARY_TIPS: Record<ActivityStatus, string[]> = {
    active: [
        'Small habits add up - keep checking in throughout the day.',
        'A short walk after meals can help with digestion and energy.',
        'Try to take a few deep breaths between tasks to reset focus.',
        'Sleep is a multiplier - aim for a consistent bedtime tonight.',
        'Drinking a glass of water before each meal helps with hunger cues.',
        'Stretching for two minutes can ease tension from long sitting.',
        'Protein with every meal helps keep you full and supports recovery.',
        'Sunlight in the morning supports better mood and sleep rhythm.',
        "Plan tomorrow's first meal tonight - one less decision in the morning.",
        'Consistency beats intensity - showing up is what counts.',
    ],
    sick: [
        'Rest is not wasted time – it’s active recovery.',
        'Warm teas and broths are gentle on the stomach and hydrating.',
        'Listen to your body – it knows what it needs.',
        'Sleep is your best medicine right now.',
        'Keep a water bottle by your bed to sip throughout the day.',
    ],
    injured: [
        'Focus on nutrient‑dense foods to speed up healing.',
        'Protein and vitamin C are essential for tissue repair.',
        'Gentle movement (if allowed) can improve blood flow.',
        'Patience – recovery is a process, not an event.',
        'Track your food to ensure you’re getting enough fuel for healing.',
    ],
    on_a_break: [
        'Breaks help prevent burnout – enjoy yours!',
        'Stay hydrated, even when not training.',
        'Light activity like walking can be refreshing.',
        'Use this time to reflect on your progress.',
        'Remember: rest days are part of growth.',
    ],
};

function pickSecondaryText(status: ActivityStatus, exclude: string): string {
    const pool = SECONDARY_TIPS[status] || SECONDARY_TIPS.active;
    const filtered = pool.filter((t) => t !== exclude);
    return filtered.length > 0 ? filtered[Math.floor(Math.random() * filtered.length)] : pool[0];
}

interface AiTipsProps {
    score: number;
}

export default function AiTips({ score }: AiTipsProps) {
    const { canUsePreferences } = useCookieConsent();
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
    const [text2, setText2] = useState('');
    const lastHashRef = useRef('');
    const [aiEnabled, setAiEnabled] = useState(() => isAIEnabled() && canUsePreferences);
    const [status, setStatus] = useState<ActivityStatus>('active');

    const refresh = useCallback(() => {
        if (!canUsePreferences) {
            setAiEnabled(false);
            return;
        }
        
        if (!isAIEnabled()) {
            setAiEnabled(false);
            return;
        }
        const state = loadActivityStatus();
        const effective = getEffectiveStatus(state);
        setStatus(effective);

        const stats = getCurrentStats();
        if (stats._hash === lastHashRef.current) return;

        lastHashRef.current = stats._hash;
        const msg = pickMessage(stats, effective);
        const secondary = pickSecondaryText(effective, msg.text);
        setAiEnabled(true);
        setTitle(msg.title);
        setText(msg.text);
        setText2(secondary);
    }, [canUsePreferences]);

    useEffect(() => {
        if (!canUsePreferences) {
            setAiEnabled(false);
            return;
        }
        refresh();
        window.addEventListener('storage', refresh);
        const minuteInterval = setInterval(refresh, 60000);
        const handler = () => refresh();
        window.addEventListener('requestAITipUpdate', handler);
        (window as typeof window & { refreshAITip?: () => void }).refreshAITip = refresh;
        return () => {
            clearInterval(minuteInterval);
            window.removeEventListener('storage', refresh);
            window.removeEventListener('requestAITipUpdate', handler);
        };
    }, [refresh, canUsePreferences]);

    return (
        <div id="AiBox" className={aiEnabled ? 'ai' : ''}>
            <div className="dashboard-hero">
                <div className="dashboard-hero-dash">
                    <div className="dashboard-kicker">Today</div>
                    <div className="dashboard-title">Dashboard</div>
                    <div className="dashboard-status" id="dashboardStatus">
                        Ready when you are.
                    </div>
                </div>
                <ScoreRing score={score} />
            </div>
            <div className="dashboard-widget ai-tip-widget" role="region" aria-label="Health tip">
                <div className="dashboard-widget-rep">
                    {aiEnabled && canUsePreferences ? (
                        <>
                            <div
                                className="dashboard-widget-title"
                                id="aiTipTitle"
                                dangerouslySetInnerHTML={{ __html: title }}
                            />
                            <div className="dashboard-widget-text" id="aiTipText">
                                <div>{text}</div>
                                <div>{text2}</div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="dashboard-widget-title" id="aiTipTitle">
                                <div className="skeleton-info">
                                    <div className="skeleton-line name" />
                                </div>
                            </div>
                            <div className="dashboard-widget-text" id="aiTipText">
                                <div className="skeleton-info">
                                    <div className="skeleton-line brand" />
                                </div>
                                <div className="skeleton-info">
                                    <div className="skeleton-line brand last" />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}