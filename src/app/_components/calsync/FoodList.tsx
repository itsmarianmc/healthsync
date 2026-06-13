'use client';

import type { FoodEntry } from '../../_lib/types';

interface FoodListProps {
    entries: FoodEntry[];
    onDelete: (id: string) => void;
    onClearAll: () => void;
}

function fmtTime(ts: number) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

const today = () => new Date().toDateString();

export default function FoodList({ entries, onDelete, onClearAll }: FoodListProps) {
    const todayEntries = entries.filter(e => e.date === today()).slice().reverse();
    const totalKcal = todayEntries.reduce((s, e) => s + e.kcal, 0);

    return (
        <div className="log-section" id="cs-logSection">
            <div className="section-title">
                Timeline
                <button className="btn" id="cs-clearAll" style={{ padding: '6px 6px', width: 'unset' }} onClick={onClearAll}>
                    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="currentColor">
                        <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                    </svg>
                </button>
            </div>
            <div className="log-list" id="cs-logList">
                {todayEntries.length === 0
                    ? <div className="empty-state"><div className="empty-icon"><i className="fa-solid fa-utensils" /></div>Nothing logged yet.<br />Scan a barcode or search for food!</div>
                    : (
                        <>
                            <div className="log-date-header">
                                <span>Today</span>
                                <span className="log-date-total">{Math.round(totalKcal)} kcal</span>
                            </div>
                            {todayEntries.map(e => {
                                const subInfo = e.amount ? `${e.amount}${e.unit || 'g'}${e.brand ? ' · ' + e.brand : ''}` : '';
                                return (
                                    <div key={e.id} className="log-item" data-id={e.id}>
                                        <div className="log-emoji no-select">
                                            <i className={e.emoji || 'fa-solid fa-utensils'} style={{ color: e.color || 'var(--accent)' }} />
                                        </div>
                                        <div className="log-info">
                                            <div className="log-name">{e.food}</div>
                                            <div className="log-time">{fmtTime(e.ts)}{subInfo ? ' · ' + subInfo : ''}</div>
                                        </div>
                                        <div className="log-kcal">+{Math.round(e.kcal)} kcal</div>
                                        <button className="log-delete" onClick={() => onDelete(e.id)}>
                                            <svg height="20" viewBox="0 -960 960 960" width="20" fill="var(--text3)">
                                                <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                                            </svg>
                                        </button>
                                    </div>
                                );
                            })}
                        </>
                    )
                }
            </div>
        </div>
    );
}
