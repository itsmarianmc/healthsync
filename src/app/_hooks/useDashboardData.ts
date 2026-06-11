'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DashboardData, FoodEntry, DrinkEntry, WeekDay, RecentEntry } from '../_lib/types';

function readList<T>(key: string): T[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

function readGoal(key: string, fallback: number, allowZero = false): number {
  if (typeof localStorage === 'undefined') return fallback;
  const v = parseInt(localStorage.getItem(key) || String(fallback), 10);
  if (!Number.isFinite(v)) return fallback;
  if (allowZero) return Math.max(v, 0);
  return v > 0 ? v : fallback;
}

function todayString(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toDateString();
}

function entryDate(entry: FoodEntry | DrinkEntry): string {
  if ('date' in entry && entry.date) return entry.date;
  if ('ts' in entry && entry.ts) return new Date(entry.ts).toDateString();
  return '';
}

function sum<T>(list: T[], getter: (item: T) => number): number {
  return list.reduce((t, i) => t + (getter(i) || 0), 0);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v || 0));
}

function formatTime(ts: number): string {
  if (!ts) return '-';
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatAgo(ts: number): string {
  if (!ts) return '-';
  const minutes = Math.floor((Date.now() - ts) / 60000);
  if (minutes < 1) return 'Now';
  if (minutes < 60) return minutes + 'm';
  if (minutes < 1440) return Math.floor(minutes / 60) + 'h';
  return Math.floor(minutes / 1440) + 'd';
}

export function formatMl(value: number): string {
  if (value >= 1000) return (value / 1000).toFixed(1).replace('.', ',') + ' L';
  return Math.round(value) + ' ml';
}

export function calculateStreak(entries: (FoodEntry | DrinkEntry)[]): number {
  const dates = new Set(entries.map(entryDate).filter(Boolean));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if (!dates.has(todayString(-i))) break;
    streak++;
  }
  return streak;
}

export function getWeekData(
  calsyncEntries: FoodEntry[], dropsyncEntries: DrinkEntry[],
  calGoal: number, waterGoal: number
): WeekDay[] {
  const days: WeekDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toDateString();
    const calEntries = calsyncEntries.filter(e => entryDate(e) === dateKey);
    const waterEntries = dropsyncEntries.filter(e => entryDate(e) === dateKey);
    const calories = sum(calEntries, e => e.kcal);
    const water = sum(waterEntries, e => (e as DrinkEntry).amount);
    days.push({
      date, dateKey,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      calories, water,
      calPercent: clamp01(calories / calGoal),
      waterPercent: clamp01(water / waterGoal),
    });
  }
  return days;
}

function combinedEntries(calsync: FoodEntry[], dropsync: DrinkEntry[]): RecentEntry[] {
  const food: RecentEntry[] = calsync.map(e => ({
    type: 'food', name: e.food || 'Food',
    icon: e.emoji || 'fa-solid fa-utensils', color: e.color || 'var(--accent)',
    amount: Math.round(e.kcal || 0) + ' kcal', meta: formatTime(e.ts),
    ts: e.ts || 0, date: entryDate(e),
  }));
  const drinks: RecentEntry[] = dropsync.map(e => ({
    type: 'drink', name: e.drink || 'Drink',
    icon: e.emoji || 'fa-solid fa-droplet', color: e.color || '#5cc9fa',
    amount: '+' + formatMl(e.amount || 0), meta: formatTime(e.ts),
    ts: e.ts || 0, date: entryDate(e),
  }));
  return [...food, ...drinks].sort((a, b) => b.ts - a.ts);
}

function computeDashboard(): DashboardData {
  const calsyncEntries = readList<FoodEntry>('calsync_v1');
  const dropsyncEntries = readList<DrinkEntry>('dropsync_v3');
  const today = todayString();
  const todayCalEntries = calsyncEntries.filter(e => entryDate(e) === today);
  const todayWaterEntries = dropsyncEntries.filter(e => entryDate(e) === today);

  const totalCal = sum(todayCalEntries, e => e.kcal);
  const totalWater = sum(todayWaterEntries, e => (e as DrinkEntry).amount);
  const totalProtein = sum(todayCalEntries, e => e.prot);
  const totalCarbs = sum(todayCalEntries, e => e.carb);
  const totalFat = sum(todayCalEntries, e => e.fat);
  const calGoal = readGoal('calsync_goal', 2000);
  const waterGoal = readGoal('dropsync_goal', 2500);
  const macroGoals = {
    protein: readGoal('calsync_goal_protein', 0, true),
    carbs: readGoal('calsync_goal_carbs', 0, true),
    fat: readGoal('calsync_goal_fat', 0, true),
  };

  const calPercent = clamp01(totalCal / calGoal);
  const waterPercent = clamp01(totalWater / waterGoal);
  const proteinPercent = macroGoals.protein > 0 ? clamp01(totalProtein / macroGoals.protein) : 0;

  const macroValues = [
    macroGoals.protein > 0 ? proteinPercent : null,
    macroGoals.carbs > 0 ? clamp01(totalCarbs / macroGoals.carbs) : null,
    macroGoals.fat > 0 ? clamp01(totalFat / macroGoals.fat) : null,
  ].filter((v): v is number => v !== null);
  const macroPercent = macroValues.length ? macroValues.reduce((a, b) => a + b, 0) / macroValues.length : null;

  const scoreParts = macroPercent === null
    ? [{ value: calPercent, weight: 0.5 }, { value: waterPercent, weight: 0.5 }]
    : [{ value: calPercent, weight: 0.4 }, { value: waterPercent, weight: 0.35 }, { value: macroPercent, weight: 0.25 }];
  const score = Math.round(scoreParts.reduce((t, p) => t + p.value * p.weight, 0) * 100);

  const allEntries = combinedEntries(calsyncEntries, dropsyncEntries);
  const todayCombined = allEntries.filter(e => e.date === today);
  const entryCount = todayCalEntries.length + todayWaterEntries.length;
  const latest = todayCombined[0] || allEntries[0];

  return {
    totalCal, totalWater, totalProtein, totalCarbs, totalFat,
    calGoal, waterGoal, macroGoals,
    calPercent, waterPercent, proteinPercent, score, entryCount,
    streak: calculateStreak([...calsyncEntries, ...dropsyncEntries]),
    lastEntryAgo: latest ? formatAgo(latest.ts) : '-',
    weekData: getWeekData(calsyncEntries, dropsyncEntries, calGoal, waterGoal),
    recentEntries: allEntries,
  };
}

function defaultDashboardData(): DashboardData {
  return {
    totalCal: 0, totalWater: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0,
    calGoal: 2000, waterGoal: 2500,
    macroGoals: { protein: 0, carbs: 0, fat: 0 },
    calPercent: 0, waterPercent: 0, proteinPercent: 0, score: 0, entryCount: 0,
    streak: 0, lastEntryAgo: '-',
    weekData: [],
    recentEntries: [],
  };
}

export function useDashboardData(): DashboardData {
  const [data, setData] = useState<DashboardData>(defaultDashboardData);

  const refresh = useCallback(() => setData(computeDashboard()), []);

  useEffect(() => {
    refresh();
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('viewChanged', refresh);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    const interval = setInterval(refresh, 30000);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('viewChanged', refresh);
      clearInterval(interval);
    };
  }, [refresh]);

  return data;
}
