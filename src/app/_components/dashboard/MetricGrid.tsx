'use client';

import { formatMl } from '../../_hooks/useDashboardData';

interface MetricGridProps {
    totalCal: number;
    totalWater: number;
    calGoal: number;
    waterGoal: number;
    calPercent: number;
    waterPercent: number;
}

export default function MetricGrid({ totalCal, totalWater, calGoal, waterGoal, calPercent, waterPercent }: MetricGridProps) {
    const calLeft = totalCal > calGoal
        ? Math.round(totalCal - calGoal) + ' kcal over'
        : Math.round(calGoal - totalCal) + ' kcal left';
    const waterLeft = totalWater > waterGoal
        ? formatMl(totalWater - waterGoal) + ' over'
        : formatMl(waterGoal - totalWater) + ' left';

    return (
        <div className="dashboard-metric-grid" id="dashboardMetricGrid">
            <div className="dashboard-metric-card calorie-card">
                <div className="dashboard-metric-top">
                <div className="dashboard-metric-icon"><i className="fa-solid fa-fire-flame-curved" /></div>
                <div className="dashboard-metric-label">Calories</div>
                </div>
                <div className="dashboard-metric-value"><span id="dashboardCalories">{Math.round(totalCal)}</span><small>kcal</small></div>
                <div className="dashboard-metric-sub" id="dashboardCalLeft">{calLeft}</div>
                <div className="dashboard-card-progress">
                <div id="dashboardCalProgress" className="progress-bar" role="progressbar" aria-valuenow={Math.round(calPercent * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Calories: ${Math.round(calPercent * 100)}% of goal`} style={{ width: Math.max(0, Math.min(100, calPercent * 100)) + '%' }} />
                </div>
                <div className="dashboard-metric-goal" id="dashboardCalGoal">Goal {calGoal} kcal</div>
            </div>
            <div className="dashboard-metric-card water-card">
                <div className="dashboard-metric-top">
                    <div className="dashboard-metric-icon"><i className="fa-solid fa-droplet" /></div>
                    <div className="dashboard-metric-label">Hydration</div>
                </div>
                <div className="dashboard-metric-value"><span id="dashboardWater">{Math.round(totalWater)}</span><small>ml</small></div>
                <div className="dashboard-metric-sub" id="dashboardWaterLeft">{waterLeft}</div>
                <div className="dashboard-card-progress">
                    <div id="dashboardWaterProgress" className="progress-bar" role="progressbar" aria-valuenow={Math.round(waterPercent * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Hydration: ${Math.round(waterPercent * 100)}% of goal`} style={{ width: Math.max(0, Math.min(100, waterPercent * 100)) + '%' }} />
                </div>
                <div className="dashboard-metric-goal" id="dashboardWaterGoal">Goal {formatMl(waterGoal)}</div>
            </div>
        </div>
    );
}
