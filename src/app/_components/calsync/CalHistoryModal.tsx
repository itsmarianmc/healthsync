'use client';

import React, { useState, useEffect } from 'react';
import type { FoodEntry } from '../../_lib/types';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';

interface CalHistoryModalProps {
    entries: FoodEntry[];
    isOpen: boolean;
    onClose: () => void;
}

type ChartMode = 'kcal' | 'prot' | 'carb' | 'fat';

function fmtTime(ts: number) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatDateLabel(dateStr: string) {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
}

function getLast7(entries: FoodEntry[]) {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        const ds = d.toDateString();
        const de = entries.filter(e => e.date === ds);
        return {
            label: i === 6 ? 'Today' : i === 5 ? 'Yest.' : d.toLocaleDateString('en-US', { weekday: 'short' }),
            kcal: de.reduce((s,e) => s + (e.kcal||0), 0),
            prot: de.reduce((s,e) => s + (e.prot||0), 0),
            carb: de.reduce((s,e) => s + (e.carb||0), 0),
            fat:  de.reduce((s,e) => s + (e.fat||0), 0),
            date: ds,
        };
    });
}

export default function CalHistoryModal({ entries, isOpen, onClose }: CalHistoryModalProps) {
    const [chartMode, setChartMode] = useState<ChartMode>('kcal');
    const sheet = useDraggableSheet({ onClose });

    useEffect(() => {
        if (isOpen) sheet.open();
        else if (sheet.stateRef.current !== 'closed') sheet.close();
    }, [isOpen]);

    const [goal, setGoal] = useState(2000);
    const [goalMap, setGoalMap] = useState<Record<ChartMode, number>>({ kcal: 2000, prot: 0, carb: 0, fat: 0 });
    useEffect(() => {
        const g = parseInt(localStorage.getItem('calsync_goal') || '2000', 10);
        setGoal(g);
        setGoalMap({
            kcal: g,
            prot: parseInt(localStorage.getItem('calsync_goal_protein') || '0', 10),
            carb: parseInt(localStorage.getItem('calsync_goal_carbs') || '0', 10),
            fat:  parseInt(localStorage.getItem('calsync_goal_fat') || '0', 10),
        });
    }, []);

    const data7 = getLast7(entries);
    const vals = data7.map(d => d[chartMode] || 0);
    const maxVal = Math.max(...vals, goalMap[chartMode], 1);
    const goalPct = goalMap[chartMode] > 0 ? (goalMap[chartMode] / maxVal) * 100 : 0;
    const colorMap: Record<ChartMode, string> = { kcal: 'var(--accent)', prot: '#30D158', carb: '#FFD60A', fat: '#FF6B35' };
    const totals7 = data7.reduce((a,d) => ({ kcal: a.kcal+d.kcal, prot: a.prot+d.prot, carb: a.carb+d.carb, fat: a.fat+d.fat }), { kcal:0, prot:0, carb:0, fat:0 });

    const groups: Record<string, FoodEntry[]> = {};
    [...entries].reverse().forEach(e => { if (!groups[e.date]) groups[e.date] = []; groups[e.date].push(e); });

    return (
        <div className="app-overlay" id="historyOverlay" ref={sheet.overlayRef} onClick={e => { if (e.target === sheet.overlayRef.current) sheet.close(); }}>
            <div className="modal" id="historyModal" ref={sheet.modalRef}>
                <div className="modal-handle-zone" id="historyHandleZone" {...sheet.handleProps}>
                    <div className="modal-handle" />
                </div>
                <div className="modal-header">
                    <div className="modal-title">History</div>
                </div>
                <div className="modal-body" id="historyModalBody" style={{ overflowY: 'auto' }}>
                    <div className="history-list" id="historyList">
                        <div className="week-chart" data-mode={chartMode}>
                            <div className="week-chart-mode-row">
                                {(['kcal','prot','carb','fat'] as ChartMode[]).map(m => (
                                <button key={m} className={`week-chart-mode-btn${m === chartMode ? ' active' : ''}`}
                                    style={{ ['--btn-color' as string]: colorMap[m], ...(m === chartMode ? { color: colorMap[m] } : {}) }}
                                    onClick={() => setChartMode(m)}>
                                    {m === 'kcal' ? 'Calories' : m === 'prot' ? 'Protein' : m === 'carb' ? 'Carbs' : 'Fat'}
                                </button>
                                ))}
                            </div>
                            <div className="week-chart-bars">
                                {data7.map((d, i) => {
                                    const h = maxVal > 0 ? (vals[i] / maxVal) * 100 : 0;
                                    return (
                                        <div key={i} className="week-chart-col">
                                            <div className="week-chart-bar-wrap">
                                                {goalPct > 0 && <div className="week-chart-goal-line" style={{ bottom: `${goalPct}%` }} />}
                                                <div className="week-chart-bar-fill" style={{ height: `${h}%`, background: colorMap[chartMode] }} />
                                            </div>
                                            <div className="week-chart-val">{Math.round(vals[i])}</div>
                                            <div className={`week-chart-day${d.date === new Date().toDateString() ? ' today' : ''}`}>{d.label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="week-chart-avg-row">
                                <span>7-day avg: <strong style={{ color: 'var(--accent)' }}>{Math.round(totals7.kcal / 7)} kcal</strong></span>
                                <span style={{ color: '#30D158' }}>P {Math.round(totals7.prot / 7)}g</span>
                                <span style={{ color: '#FFD60A' }}>C {Math.round(totals7.carb / 7)}g</span>
                                <span style={{ color: '#FF6B35' }}>F {Math.round(totals7.fat / 7)}g</span>
                            </div>
                        </div>
                        {Object.keys(groups).length === 0
                            ? <div className="empty-state"><div className="empty-icon"><i className="fa-solid fa-clock-rotate-left" /></div>No history yet.</div>
                            : Object.entries(groups).map(([date, items]) => {
                                const totalKcal = items.reduce((s,e) => s+e.kcal, 0);
                                const totalProt = items.reduce((s,e) => s+(e.prot||0), 0);
                                const totalCarb = items.reduce((s,e) => s+(e.carb||0), 0);
                                const totalFat  = items.reduce((s,e) => s+(e.fat||0), 0);
                                const macroTotal = totalProt*4 + totalCarb*4 + totalFat*9;
                                const pp = macroTotal > 0 ? Math.round(totalProt*4/macroTotal*100) : 0;
                                const cp = macroTotal > 0 ? Math.round(totalCarb*4/macroTotal*100) : 0;
                                const fp = 100 - pp - cp;
                                return (
                                    <div key={date} className="history-day-section">
                                        <div className="log-date-header">
                                            <span>{formatDateLabel(date)}</span>
                                            <span className="log-date-total">{Math.round(totalKcal)} kcal</span>
                                        </div>
                                        {macroTotal > 0 && (
                                            <div className="history-macro-bar">
                                            <div className="history-macro-seg" style={{ width: `${pp}%`, background: '#30D158' }} title={`Protein ${Math.round(totalProt)}g`} />
                                            <div className="history-macro-seg" style={{ width: `${cp}%`, background: '#FFD60A' }} title={`Carbs ${Math.round(totalCarb)}g`} />
                                            <div className="history-macro-seg" style={{ width: `${fp}%`, background: '#FF6B35' }} title={`Fat ${Math.round(totalFat)}g`} />
                                            </div>
                                        )}
                                        {items.map(e => {
                                            const subInfo = e.amount ? `${e.amount}${e.unit||'g'}${e.brand ? ' · '+e.brand : ''}` : '';
                                            return (
                                                <div key={e.id} className="log-item no-anim">
                                                    <div className="log-emoji no-select"><i className={e.emoji||'fa-solid fa-utensils'} style={{ color: e.color||'var(--accent)' }} /></div>
                                                    <div className="log-info">
                                                        <div className="log-name">{e.food}</div>
                                                        <div className="log-time">{fmtTime(e.ts)}{subInfo ? ' · '+subInfo : ''}</div>
                                                    </div>
                                                    <div className="log-kcal">{Math.round(e.kcal)} kcal</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}
