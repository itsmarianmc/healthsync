'use client';

import { useDashboardData } from '../../_hooks/useDashboardData';
import MetricGrid from './MetricGrid';
import MacroGrid from './MacroGrid';
import WeekChart from './WeekChart';
import RecentList from './RecentList';
import NextWidget from './NextWidget';
import AiTips from './AiTips';

interface DashboardProps {
    nfl?: boolean;
    onOpenCalSync: () => void;
    onOpenDropSync: () => void;
    onOpenSettings: () => void;
}

function formatDateLabel(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function Dashboard({ nfl, onOpenCalSync, onOpenDropSync, onOpenSettings }: DashboardProps) {
    const data = useDashboardData();
    const today = new Date().toDateString();
    const dateLabel = formatDateLabel(new Date());

    const settingsIcon = (
        <svg viewBox="0 -960 960 960" fill="currentColor">
            <path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 14-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z" />
        </svg>
    );

    let statusText = 'Ready when you are.';
    if (data.entryCount > 0) {
        if (data.score >= 90) statusText = 'A strong day is coming together.';
        else if (data.waterPercent < data.calPercent) statusText = 'Food is moving. Hydration can catch up.';
        else statusText = 'Balanced progress across your day.';
    }

    return (
        <div id="dashboard-view" className={`app-view active${nfl ? ' nfl' : ''}`}>
            <div className="header">
                <div className="header-title-row">
                    <div className="header-title">Health<span>Sync</span></div>
                    <div className="button-box">
                        <button className="settings-button" id="db-openSettingsBtn" data-order="3" title="Settings" onClick={onOpenSettings}>
                        {settingsIcon}
                        </button>
                    </div>
                </div>
                <div className="header-greeting">
                    <span id="db-dateLabel">{dateLabel}</span>
                </div>
            </div>
            <div className="dashboard-shell">
                <AiTips score={data.score} />
                <div className="dashboard-actions">
                    <button id="quickAddCal" className="dashboard-action-btn" onClick={onOpenCalSync}>
                        <i className="fa-solid fa-utensils" /> Add Food
                    </button>
                    <button id="quickAddWater" className="dashboard-action-btn secondary" onClick={onOpenDropSync}>
                        <i className="fa-solid fa-droplet" /> Add Drink
                    </button>
                </div>

                <MetricGrid
                    totalCal={data.totalCal} totalWater={data.totalWater}
                    calGoal={data.calGoal} waterGoal={data.waterGoal}
                    calPercent={data.calPercent} waterPercent={data.waterPercent}
                />

                <NextWidget
                    entryCount={data.entryCount} totalCal={data.totalCal} totalWater={data.totalWater}
                    totalProtein={data.totalProtein} calGoal={data.calGoal} waterGoal={data.waterGoal}
                    macroGoals={data.macroGoals} calPercent={data.calPercent}
                    waterPercent={data.waterPercent} proteinPercent={data.proteinPercent}
                />

                <MacroGrid
                    totalProtein={data.totalProtein} totalCarbs={data.totalCarbs} totalFat={data.totalFat}
                    macroGoals={data.macroGoals}
                />

                <WeekChart weekData={data.weekData} />
                <div className="dashboard-mini-grid">
                    <div className="dashboard-mini-card">
                        <div className="dashboard-mini-icon"><i className="fa-solid fa-list-check" /></div>
                        <div className="dashboard-mini-value" id="dashboardEntryCount">{data.entryCount}</div>
                        <div className="dashboard-mini-label">Entries today</div>
                    </div>
                    <div className="dashboard-mini-card">
                        <div className="dashboard-mini-icon"><i className="fa-solid fa-stopwatch" /></div>
                        <div className="dashboard-mini-value" id="dashboardLastEntry">{data.lastEntryAgo}</div>
                        <div className="dashboard-mini-label">Last entry</div>
                    </div>
                    <div className="dashboard-mini-card">
                        <div className="dashboard-mini-icon"><i className="fa-solid fa-calendar-check" /></div>
                        <div className="dashboard-mini-value" id="dashboardStreak">{data.streak}</div>
                        <div className="dashboard-mini-label">Day streak</div>
                    </div>
                </div>

                <RecentList entries={data.recentEntries} today={today} />
            </div>
        </div>
    );
}
