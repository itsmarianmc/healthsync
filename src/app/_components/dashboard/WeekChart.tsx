'use client';

import type { WeekDay } from '../../_lib/types';
import { formatMl } from '../../_hooks/useDashboardData';

interface WeekChartProps {
    weekData: WeekDay[];
}

const today = new Date().toDateString();

export default function WeekChart({ weekData }: WeekChartProps) {
    const calAvg = Math.round(weekData.reduce((s, d) => s + d.calories, 0) / 7);
    const waterAvg = Math.round(weekData.reduce((s, d) => s + d.water, 0) / 7);

    return (
        <>
            <div className="dashboard-section-head">
                <span>7-day rhythm</span>
                <small id="dashboardWeekSummary">{calAvg} kcal / {formatMl(waterAvg)} avg</small>
            </div>
            <div className="dashboard-week-card" id="dashboardWeekCard">
                <div id="dashboardWeekChart" className="dashboard-week-chart">
                    {weekData.map(day => (
                        <div key={day.dateKey} className={`dashboard-week-day${day.dateKey === today ? ' today' : ''}`}>
                            <div className="dashboard-week-bars">
                                <div
                                    className="dashboard-week-bar calories"
                                    style={{ height: Math.max(day.calPercent * 100, day.calories ? 6 : 0) + '%' }}
                                />
                                <div
                                    className="dashboard-week-bar water"
                                    style={{ height: Math.max(day.waterPercent * 100, day.water ? 6 : 0) + '%' }}
                                />
                            </div>
                            <div className="dashboard-week-label">{day.label}</div>
                        </div>
                    ))}
                </div>
                <div className="dashboard-week-legend">
                    <span>
                        <i className="fa-solid fa-fire-flame-curved" /> Calories
                    </span>
                    <span>
                        <i className="fa-solid fa-droplet" /> Hydration
                    </span>
                </div>
            </div>
        </>
    );
}
