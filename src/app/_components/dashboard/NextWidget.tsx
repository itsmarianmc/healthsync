'use client';

import { formatMl } from '../../_hooks/useDashboardData';

interface NextWidgetProps {
    entryCount: number;
    totalCal: number;
    totalWater: number;
    totalProtein: number;
    calGoal: number;
    waterGoal: number;
    macroGoals: { protein: number; carbs: number; fat: number };
    calPercent: number;
    waterPercent: number;
    proteinPercent: number;
}

export default function NextWidget(props: NextWidgetProps) {
    const { entryCount, totalWater, totalProtein, calGoal, waterGoal, macroGoals, calPercent, waterPercent, proteinPercent } = props;

    let icon = 'fa-solid fa-bullseye';
    let title = 'Start your day';
    let text = 'Log your first meal or drink.';

    if (entryCount > 0) {
        const waterNeed = Math.max(waterGoal - totalWater, 0);
        const calNeed = Math.max(calGoal - props.totalCal, 0);
        const proteinNeed = Math.max(macroGoals.protein - totalProtein, 0);

        if (waterPercent < 0.55) {
            icon = 'fa-solid fa-droplet';
            title = 'Hydration needs focus';
            text = formatMl(waterNeed) + ' left for today.';
        } else if (macroGoals.protein > 0 && proteinPercent < 0.55) {
            icon = 'fa-solid fa-dumbbell';
            title = 'Protein is behind';
            text = Math.round(proteinNeed) + ' g left for your target.';
        } else if (calPercent < 0.65) {
            icon = 'fa-solid fa-utensils';
            title = 'Calories still open';
            text = Math.round(calNeed) + ' kcal left in your day.';
        } else if (calPercent >= 1 && waterPercent >= 1) {
            icon = 'fa-solid fa-circle-check';
            title = 'Goals complete';
            text = 'Calories and hydration are both on track.';
        } else {
            icon = 'fa-solid fa-chart-line';
            title = 'Keep the pace';
            text = 'Your day is building steadily.';
        }
    }

    return (
        <div className="dashboard-widget dashboard-next-widget">
            <div className="dashboard-widget-icon">
                <i id="dashboardNextIcon" className={icon} />
            </div>
            <div className="dashboard-widget-rep">
                <div className="dashboard-widget-label">Next up</div>
                <div className="dashboard-widget-title" id="dashboardNextTitle">{title}</div>
                <div className="dashboard-widget-text" id="dashboardNextText">{text}</div>
            </div>
        </div>
    );
}
