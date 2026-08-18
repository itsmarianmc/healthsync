'use client';

import type { RecentEntry } from '../../_lib/types';

interface RecentListProps {
    entries: RecentEntry[];
    today: string;
}

export default function RecentList({ entries, today }: RecentListProps) {
    const todayEntries = entries.filter(e => e.date === today);
    const display = todayEntries.slice(0, 5);

    return (
        <>
            <div className="dashboard-section-head">
                <span>Recent</span>
                <small id="dashboardRecentSummary">{todayEntries.length > 0 ? todayEntries.length + ' total' : 'Today'}</small>
            </div>
            <div className="dashboard-recent-list" id="dashboardRecentList">
                {display.length === 0
                    ? <div className="dashboard-empty-state">Nothing logged yet. <br />Start logging your activities!</div>
                    : display.map((entry, i) => (
                        <div key={entry.ts + '_' + i} className="dashboard-recent-item">
                            <div className="dashboard-recent-icon">
                                <i className={entry.icon} style={{ color: entry.color }} />
                            </div>
                            <div className="dashboard-recent-info">
                                <div className="dashboard-recent-name">{entry.name}</div>
                                <div className="dashboard-recent-time">{entry.meta}</div>
                            </div>
                            <div className="dashboard-recent-amount">{entry.amount}</div>
                        </div>
                    ))
                }
            </div>
        </>
    );
}
