'use client';

import type { FoodEntry, PendingFoodDraft } from '../../_lib/types';

interface FoodListProps {
    entries: FoodEntry[];
    onDelete: (id: string) => void;
    onClearAll: () => void;
    addingId?: string | null;
    pendingDrafts?: PendingFoodDraft[];
    onOpenDraft?: (id: string) => void;
    onDiscardDraft?: (id: string) => void;
}

function fmtTime(ts: number) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

const today = () => new Date().toDateString();

export default function FoodList({ entries, onDelete, onClearAll, addingId, pendingDrafts, onOpenDraft, onDiscardDraft }: FoodListProps) {
    const todayEntries = entries.filter(e => e.date === today()).slice().reverse();
    const totalKcal = todayEntries.reduce((s, e) => s + e.kcal, 0);

    return (
        <div className="log-section" id="cs-logSection">
            {pendingDrafts && pendingDrafts.length > 0 && (
                <>
                    <div className="section-title">Pending</div>
                    <div className="pending-list" id="cs-pendingList">
                        {pendingDrafts.map(d => {
                            const subInfo = `${d.amount}${d.unit}${d.food.brand ? ' · ' + d.food.brand : ''}`;
                            const ratio = d.amount / 100;
                            const kcal = Math.round(d.food.kcalPer100 * ratio);
                            const prot = Math.round(d.food.protPer100 * ratio * 10) / 10;
                            const carb = Math.round(d.food.carbPer100 * ratio * 10) / 10;
                            const fat  = Math.round(d.food.fatPer100  * ratio * 10) / 10;
                            return (
                                <div
                                    key={d.id}
                                    className="pending-item"
                                    data-id={d.id}
                                    onClick={() => onOpenDraft?.(d.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenDraft?.(d.id); } }}
                                >
                                    <div className="log-emoji no-select">
                                        <i className={d.food.emoji || 'fa-solid fa-utensils'} style={{ color: d.food.color || 'var(--accent)' }} />
                                    </div>
                                    <div className="log-info">
                                        <div className="log-name">
                                            {d.food.name}
                                        </div>
                                        <div className="log-time">{fmtTime(d.ts)} · {subInfo}</div>
                                        <div className="log-details">
                                            <span className="log-detail log-detail-cal">C {kcal}</span>
                                            <span className="log-detail log-detail-prot">P {prot}g</span>
                                            <span className="log-detail log-detail-carb">C {carb}g</span>
                                            <span className="log-detail log-detail-fat">F {fat}g</span>
                                        </div>
                                    </div>
                                    <div className="log-kcal pending-kcal">~{kcal} kcal</div>
                                    <button
                                        className="log-delete"
                                        aria-label="Discard pending draft"
                                        title="Discard"
                                        onClick={(e) => { e.stopPropagation(); onDiscardDraft?.(d.id); }}
                                    >
                                        <svg height="20" viewBox="0 -960 960 960" width="20" fill="var(--text3)">
                                            <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
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
                                            <div className="log-name">{e.food}{addingId === e.id && (
                                                <span className="log-pending">
                                                    <i className="fa-solid fa-circle-notch fa-spin" /> Logging...
                                                </span>
                                            )}</div>
                                            <div className="log-time">{fmtTime(e.ts)}{subInfo ? ' · ' + subInfo : ''}</div>
                                            <div className="log-details">
                                                <span className="log-detail log-detail-cal">C {Math.round(e.kcal)}</span>
                                                <span className="log-detail log-detail-prot">P {e.prot}g</span>
                                                <span className="log-detail log-detail-carb">C {e.carb}g</span>
                                                <span className="log-detail log-detail-fat">F {e.fat}g</span>
                                            </div>
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
