'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ScoreRing from './ScoreRing';

const REFRESH_INTERVAL = 5 * 60 * 1000;

function isAIEnabled() {
  return typeof localStorage !== 'undefined' && localStorage.getItem('calsync_ai_enabled') === 'true';
}

function getCurrentStats() {
  if (typeof localStorage === 'undefined') return {
    totalCal: 0, calGoal: 2000, totalWater: 0, waterGoal: 2500,
    totalProtein: 0, proteinGoal: 0, entryCount: 0,
    suppTracking: false, creatineGoal: 0, magnesiumGoal: 0,
    creatineTaken: false, magnesiumTaken: false,
    _hash: ''
  };
  const today = new Date().toDateString();
  const cal = (() => { try { return JSON.parse(localStorage.getItem('calsync_v1') || '[]'); } catch { return []; } })();
  const water = (() => { try { return JSON.parse(localStorage.getItem('dropsync_v3') || '[]'); } catch { return []; } })();
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
    } catch { return {}; }
  })();
  const creatineTaken = !!taken.creatine;
  const magnesiumTaken = !!taken.magnesium;
  return {
    totalCal, calGoal, totalWater, waterGoal, totalProtein, proteinGoal, entryCount,
    suppTracking, creatineGoal, magnesiumGoal, creatineTaken, magnesiumTaken,
    _hash: `${today}|${totalCal}|${totalWater}|${totalProtein}|${entryCount}|${calGoal}|${waterGoal}|${proteinGoal}|${suppTracking ? 1 : 0}|${creatineGoal}|${magnesiumGoal}|${creatineTaken ? 1 : 0}|${magnesiumTaken ? 1 : 0}`
  };
}

function fmt(ml: number) { return ml >= 1000 ? (ml / 1000).toFixed(1).replace('.', ',') + ' L' : Math.round(ml) + ' ml'; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function pickMessage(stats: ReturnType<typeof getCurrentStats>): { title: string; text: string } {
  const {
    totalCal, calGoal, totalWater, waterGoal, totalProtein, proteinGoal, entryCount,
    suppTracking, creatineGoal, magnesiumGoal, creatineTaken, magnesiumTaken,
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

  if (entryCount === 0) {
    if (hour < 10) return { title: '<i class="fa-regular fa-sun"></i> Good morning!', text: 'Start the day with your first entry - small steps, big impact.' };
    if (hour < 14) return { title: '<i class="fa-solid fa-utensils"></i> Nothing logged yet', text: 'Don\'t forget to log your lunch so your balance is correct.' };
    if (hour < 18) return { title: '<i class="fa-solid fa-pen"></i> Log now', text: 'The afternoon is running - start tracking before the day ends.' };
    return { title: '<i class="fa-regular fa-moon"></i> Still time today', text: 'Log what you ate - every entry counts for your overview.' };
  }

  if (calPct >= 0.97 && waterPct >= 0.97 && (protPct === null || protPct >= 0.97) && allSuppDone)
    return { title: '<i class="fa-solid fa-trophy"></i> Perfect day!', text: 'All goals in the green. That\'s how tracking is fun!' };

  if (calPct > 1.15) {
    const over = Math.round(totalCal - calGoal);
    return { title: '<i class="fa-solid fa-triangle-exclamation"></i> Calorie budget exceeded', text: `You are ${over} kcal over your goal. More water and movement can help balance it out.` };
  }

  if (waterPct < 0.4 && calPct > 0.4)
    return { title: '<i class="fa-solid fa-droplet"></i> Drink more!', text: `You have only drunk ${fmt(totalWater)} of ${fmt(waterGoal)}. Place a glass of water now.` };

  if (protPct !== null && protPct < 0.5 && calPct > 0.5) {
    const protLeft = Math.round(proteinGoal - totalProtein);
    return { title: '<i class="fa-solid fa-dumbbell"></i> Protein behind', text: `Protein is lagging - ${protLeft}g missing. Cottage cheese, eggs or legumes help quickly.` };
  }

  if (hour >= 18 && waterPct < 0.8)
    return { title: '<i class="fa-regular fa-moon"></i> Evening check: Water', text: `${fmt(waterLeft)} left to your water goal. Actively drink now.` };

  if (anySupp && hour >= 19 && !allSuppDone) {
    const missing: string[] = [];
    if (hasCreatine && !creatineTaken) missing.push(`creatine (${creatineGoal} g)`);
    if (hasMagnesium && !magnesiumTaken) missing.push(`magnesium (${magnesiumGoal} mg)`);
    return { title: '<i class="fa-solid fa-capsules"></i> Supplement reminder', text: `Don\'t forget your ${missing.join(' and ')} before the day ends.` };
  }

  if (anySupp && allSuppDone && calPct >= 0.5)
    return { title: '<i class="fa-solid fa-circle-check"></i> Supplements done', text: 'Nice - your supplements are checked off for today. Keep the streak going.' };

  if (hasCreatine && !creatineTaken && hour >= 12 && hour < 19)
    return { title: '<i class="fa-solid fa-dumbbell"></i> Creatine pending', text: `Take your ${creatineGoal} g of creatine - easiest with your next drink.` };

  if (hasMagnesium && !magnesiumTaken && hour >= 17)
    return { title: '<i class="fa-solid fa-bolt"></i> Magnesium tonight', text: `${magnesiumGoal} mg of magnesium in the evening can support recovery and sleep.` };

  if (calPct >= 0.5 && calPct <= 1.0 && waterPct >= 0.5)
    return { title: '<i class="fa-solid fa-chart-line"></i> Good progress', text: `Calories and water are balanced. ${calLeft > 0 ? calLeft + ' kcal left to daily goal.' : 'Calorie goal reached!'}` };

  if (hour < 12 && calPct < 0.4)
    return { title: '<i class="fa-regular fa-sun"></i> Day is starting', text: `${Math.round(totalCal)} kcal so far - the day is still young. Keep tracking.` };

  return pick([
    { title: '<i class="fa-solid fa-chart-line"></i> Keep going', text: 'You\'re doing great. Stay consistent through the day.' },
    { title: '<i class="fa-solid fa-star"></i> Tracking well', text: 'Every entry helps you understand your body better.' },
  ]);
}

const SECONDARY_TIPS: string[] = [
  'Small habits add up - keep checking in throughout the day.',
  'A short walk after meals can help with digestion and energy.',
  'Try to take a few deep breaths between tasks to reset focus.',
  'Sleep is a multiplier - aim for a consistent bedtime tonight.',
  'Drinking a glass of water before each meal helps with hunger cues.',
  'Stretching for two minutes can ease tension from long sitting.',
  'Protein with every meal helps keep you full and supports recovery.',
  'Sunlight in the morning supports better mood and sleep rhythm.',
  'Plan tomorrow\'s first meal tonight - one less decision in the morning.',
  'Consistency beats intensity - showing up is what counts.',
];

function pickSecondaryText(exclude: string): string {
  const pool = SECONDARY_TIPS.filter(t => t !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

interface AiTipsProps {
  score: number;
}

export default function AiTips({ score }: AiTipsProps) {
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
    const [text2, setText2] = useState('');
    const [loaded, setLoaded] = useState(false);
    const lastHashRef = useRef('');
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const skeletonTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const refresh = useCallback(() => {
        if (!isAIEnabled()) {
            if (skeletonTimeoutRef.current) { clearTimeout(skeletonTimeoutRef.current); skeletonTimeoutRef.current = null; }
            setLoaded(false);
            return;
        }
        const stats = getCurrentStats();
        if (stats._hash === lastHashRef.current && loaded) return;
        lastHashRef.current = stats._hash;
        const msg = pickMessage(stats);
        const secondary = pickSecondaryText(msg.text);
        if (skeletonTimeoutRef.current) clearTimeout(skeletonTimeoutRef.current);
        setLoaded(false);
        const delay = 2000 + Math.random() * 1000;
        skeletonTimeoutRef.current = setTimeout(() => {
            setTitle(msg.title);
            setText(msg.text);
            setText2(secondary);
            setLoaded(true);
            skeletonTimeoutRef.current = null;
        }, delay);
    }, [loaded]);

    useEffect(() => {
        refresh();
        intervalRef.current = setInterval(refresh, REFRESH_INTERVAL);
        window.addEventListener('storage', refresh);
        const handler = () => refresh();
        window.addEventListener('requestAITipUpdate', handler);
        (window as typeof window & { refreshAITip?: () => void }).refreshAITip = refresh;
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (skeletonTimeoutRef.current) clearTimeout(skeletonTimeoutRef.current);
            window.removeEventListener('storage', refresh);
            window.removeEventListener('requestAITipUpdate', handler);
        };
    }, [refresh]);

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    const aiEnabled = mounted && isAIEnabled();

    if (!mounted) return null;

    return (
        <div id="AiBox" className={aiEnabled ? 'ai' : ''}>
            <div className="dashboard-hero">
                <div className="dashboard-hero-dash">
                    <div className="dashboard-kicker">Today</div>
                    <div className="dashboard-title">Dashboard</div>
                    <div className="dashboard-status" id="dashboardStatus">Ready when you are.</div>
                </div>
                <ScoreRing score={score} />
            </div>
            <div className="dashboard-widget ai-tip-widget">
                <div className="dashboard-widget-rep">
                    {loaded && aiEnabled ? (
                        <>
                            <div className="dashboard-widget-title" id="aiTipTitle" dangerouslySetInnerHTML={{ __html: title }} />
                            <div className="dashboard-widget-text" id="aiTipText">
                                <div>{text}</div>
                                <div>{text2}</div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="dashboard-widget-title" id="aiTipTitle">
                                <div className="skeleton-info"><div className="skeleton-line name" /></div>
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
