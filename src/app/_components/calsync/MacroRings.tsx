'use client';

import { useSyncExternalStore } from 'react';
import type { FoodEntry } from '../../_lib/types';

const MACRO_CIRC = 2 * Math.PI * 16;

interface MacroRingsProps {
    entries: FoodEntry[];
    goal: number;
}

function subscribeStorage(callback: () => void) {
    window.addEventListener('storage', callback);
    return () => window.removeEventListener('storage', callback);
}

function useStorageInt(key: string, fallback: number): number {
    return useSyncExternalStore(
        subscribeStorage,
        () => parseInt(localStorage.getItem(key) || String(fallback), 10),
        () => fallback,
    );
}

function useTodayString(): string {
    return useSyncExternalStore(
        () => () => {},
        () => new Date().toDateString(),
        () => '',
    );
}

export default function MacroRings({ entries, goal }: MacroRingsProps) {
    const today = useTodayString();
    const proteinGoal = useStorageInt('calsync_goal_protein', 0);
    const carbsGoal = useStorageInt('calsync_goal_carbs', 0);
    const fatGoal = useStorageInt('calsync_goal_fat', 0);

    const todayEntries = today ? entries.filter(e => e.date === today) : [];

    const totals = todayEntries.reduce(
        (acc, e) => ({ kcal: acc.kcal + (e.kcal || 0), prot: acc.prot + (e.prot || 0), carb: acc.carb + (e.carb || 0), fat: acc.fat + (e.fat || 0) }),
        { kcal: 0, prot: 0, carb: 0, fat: 0 }
    );

    const calPct = Math.min(totals.kcal / (goal || 1), 1);
    const calOffset = MACRO_CIRC * (1 - calPct);
    const calLeft = Math.round(goal - totals.kcal);

    const macros = [
        {
            key: 'protein',
            id: 'cs-proteinRing',
            leftId: 'cs-proteinLeft',
            name: 'PROTEIN',
            value: totals.prot,
            goalVal: proteinGoal,
            color: '#30D158'
        },
        {
            key: 'carbs',
            id: 'cs-carbsRing',
            leftId: 'cs-carbsLeft',
            name: 'CARBS',
            value: totals.carb,
            goalVal: carbsGoal,
            color: '#FFD60A'
        },
        {
            key: 'fat',
            id: 'cs-fatRing',
            leftId: 'cs-fatLeft',
            name: 'FAT',
            value: totals.fat,
            goalVal: fatGoal,
            color: '#FF6B35'
        },
    ];

    const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const ds = d.toDateString();
        const de = entries.filter(e => e.date === ds);
        return {
            label: i === 6 ? 'Today' : i === 5 ? 'Yest.' : d.toLocaleDateString('en-US', { weekday: 'short' }),
            kcal: de.reduce((s, e) => s + (e.kcal || 0), 0),
            date: ds,
        };
    });
    const maxKcal = Math.max(...last7.map(d => d.kcal), goal, 1);
    const goalLinePct = (goal / maxKcal) * 100;

    const macroGoalRows = [
        {
            id: 'cs-macroGoalRow_calories',
            barId: 'cs-macroBar_calories',
            labelId: 'cs-macroBarLabel_calories',
            label: 'Calories',
            icon: 'fa-solid fa-fire',
            color: 'var(--accent)',
            val: totals.kcal,
            goalVal: goal,
            unit: ' kcal',
            always: true
        },
        {
            id: 'cs-macroGoalRow_protein',
            barId: 'cs-macroBar_protein',
            labelId: 'cs-macroBarLabel_protein',
            label: 'Protein',
            icon: 'fa-solid fa-dumbbell',
            color: '#30D158',
            val: totals.prot,
            goalVal: proteinGoal,
            unit: 'g',
            always: false
        },
        {
            id: 'cs-macroGoalRow_carbs',
            barId: 'cs-macroBar_carbs',
            labelId: 'cs-macroBarLabel_carbs',
            label: 'Carbs',
            icon: 'fa-solid fa-wheat-awn',
            color: '#FFD60A',
            val: totals.carb,
            goalVal: carbsGoal,
            unit: 'g',
            always: false
        },
        {
            id: 'cs-macroGoalRow_fat',
            barId: 'cs-macroBar_fat',
            labelId: 'cs-macroBarLabel_fat',
            label: 'Fat',
            icon: 'fa-solid fa-droplet',
            color: '#FF6B35',
            val: totals.fat,
            goalVal: fatGoal,
            unit: 'g',
            always: false
        },
    ];

    const statCount = todayEntries.length;
    const statLast = todayEntries.length ? fmtAgo(todayEntries[todayEntries.length - 1].ts) : '-';
    const statPct = Math.round(calPct * 100) + '%';

    return (
        <>
            <div className="dashboard">
                <div className="dashboard-stats-row">
                    <div className="calorie-week-widget">
                        <div className="calorie-info">
                            <div className="calorie-label"><i className="fa-solid fa-fire-flame-curved" /> Calories</div>
                            <div className="calorie-left" id="cs-calorieLeft">
                                {calLeft >= 0 ? `${Math.round(calLeft)} kcal left` : `${Math.abs(calLeft)} kcal over`}
                            </div>
                        </div>
                        <div className="mini-week-chart" id="cs-miniWeekChart">
                            <div className="week-chart-bars">
                                {last7.map((day, i) => {
                                    const h = maxKcal > 0 ? (day.kcal / maxKcal) * 100 : 0;
                                    return (
                                        <div key={i} className="week-chart-col">
                                            <div className="week-chart-bar-wrap">
                                                <div className="week-chart-goal-line" style={{ bottom: `${goalLinePct}%` }} />
                                                <div className="week-chart-bar-fill" style={{ height: `${h}%`, background: 'var(--accent)' }} />
                                            </div>
                                            <div className={`week-chart-day${day.date === today ? ' today' : ''}`}>{day.label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="calorie-ring-widget">
                        <svg className="calorie-ring-svg" viewBox="0 0 40 40">
                            <circle className="calorie-ring-bg" cx="20" cy="20" r="16" />
                            <circle className="calorie-ring-fill" id="cs-calorieRing" cx="20" cy="20" r="16" style={{ strokeDasharray: MACRO_CIRC, strokeDashoffset: calOffset }} />
                        </svg>
                        <div className="calorie-ring-percent" id="cs-caloriePercent">{Math.round(calPct * 100)}%</div>
                    </div>
                </div>
                <div className="macro-widgets">
                    {macros.map(m => {
                        const pct = m.goalVal > 0 ? Math.min(m.value / m.goalVal, 1) : 0;
                        const offset = MACRO_CIRC * (1 - pct);
                        const diff = Math.round(m.goalVal - m.value);
                        const leftText = m.goalVal === 0 ? 'Goal not set' : diff >= 0 ? `${diff}g left` : `${Math.abs(diff)}g over`;
                        return (
                            <div key={m.key} className="macro-card" data-macro={m.key}>
                                <div className="macro-card-top">
                                    <span className="macro-name">{m.name}</span>
                                    <div className="ring">
                                        <svg className="macro-ring" viewBox="0 0 40 40">
                                            <circle className="macro-ring-bg" cx="20" cy="20" r="16" />
                                            <circle className="macro-ring-fill" id={m.id} cx="20" cy="20" r="16" style={{ strokeDasharray: MACRO_CIRC, strokeDashoffset: offset }} />
                                        </svg>
                                    </div>
                                </div>
                                <div className="macro-card-bottom"><span id={m.leftId}>{leftText}</span></div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="stats-row" id="cs-statsRowSecondary">
                <div className="stat-card">
                    <div className="stat-icon"><i className="fa-solid fa-utensils" /></div>
                    <div className="stat-value" id="cs-statCount">{statCount}</div>
                    <div className="stat-label">Entries today</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><i className="fa-solid fa-stopwatch" /></div>
                    <div className="stat-value" id="cs-statLast">{statLast}</div>
                    <div className="stat-label">Last entry</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><i className="fa-solid fa-fire-flame-curved" /></div>
                    <div className="stat-value" id="cs-statPct">{statPct}</div>
                    <div className="stat-label">Progress</div>
                </div>
            </div>
            <div className="macro-goals-section" id="cs-macroGoalsSection">
                {macroGoalRows.map(row => {
                    const hidden = !row.always && (!row.goalVal || row.goalVal <= 0);
                    const pct = row.goalVal > 0 ? Math.min(row.val / row.goalVal, 1) * 100 : 0;
                    const label = `${Math.round(row.val)} / ${row.goalVal}${row.unit}`;
                    return (
                        <div key={row.id} id={row.id} className={`macro-goal-row${hidden ? ' hidden' : ''}`}>
                            <div className="macro-goal-header">
                                <span className="macro-goal-name" style={{ color: row.color }}><i className={row.icon} /> {row.label}</span>
                                <span className="macro-goal-label-val" id={row.labelId}>{label}</span>
                            </div>
                            <div className="macro-goal-track">
                                <div className="macro-goal-fill" id={row.barId} style={{ background: row.color, width: `${pct}%` }} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

function fmtAgo(ts: number) {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m} min ago`;
    return `${Math.floor(m / 60)} hr ago`;
}
