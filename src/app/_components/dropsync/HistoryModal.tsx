'use client';

import React, { useEffect } from 'react';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import type { DrinkEntry } from '../../_lib/types';

interface HistoryModalProps {
    entries: DrinkEntry[];
    goal: number;
    isOpen: boolean;
    onClose: () => void;
}

function fmtTime(ts: number) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtMl(ml: number) {
    return ml >= 1000 ? (ml/1000).toFixed(1).replace('.',',') + ' L' : ml + ' ml';
}

function getLast7(entries: DrinkEntry[]) {
    const totals = new Map<string, number>();
    entries.forEach(e => totals.set(e.date, (totals.get(e.date) || 0) + e.amount));
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - i));
        const date = day.toDateString();
        return {
            date,
            label: i === 6 ? 'Today' : i === 5 ? 'Yest.' : day.toLocaleDateString('en-US', { weekday: 'short' }),
            amount: totals.get(date) || 0,
        };
    });
}

function goalColor(amount: number, goal: number) {
    if (goal <= 0) return { className: 'ds-week-neutral', mix: '0%' };
    const ratio = Math.max(0, Math.min(amount / goal, 2));
    if (ratio <= 0.5) return { className: 'ds-week-red-yellow', mix: `${ratio * 200}%` };
    if (ratio <= 1) return { className: 'ds-week-yellow-green', mix: `${(ratio - 0.5) * 200}%` };
    return { className: 'ds-week-green-dark', mix: `${(ratio - 1) * 100}%` };
}

function formatDateLabel(dateStr: string) {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function HistoryModal({ entries, goal, isOpen, onClose }: HistoryModalProps) {
    const { modalRef, overlayRef, open, close: snapToClosed, handleProps } = useDraggableSheet({ onClose });
    useEffect(() => { if (isOpen) open(); else snapToClosed(); }, [isOpen, open, snapToClosed]);

    const groups: Record<string, DrinkEntry[]> = {};
    [...entries].reverse().forEach(e => {
        if (!groups[e.date]) groups[e.date] = [];
        groups[e.date].push(e);
    });
    const data7 = getLast7(entries);
    const maxAmount = Math.max(...data7.map(day => day.amount), goal, 1);
    const goalPct = goal > 0 ? goal / maxAmount * 100 : 0;
    const average = data7.reduce((sum, day) => sum + day.amount, 0) / 7;
    const averageColor = goalColor(average, goal);

    return (
        <div className="app-overlay appoverlay" id="ds-historyOverlay" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) snapToClosed(); }}>
            <div className="modal" id="ds-historyModal" ref={modalRef} role="dialog" aria-modal="true" aria-label="Hydration history">
                <div
                    className="modal-handle-zone"
                    id="ds-historyHandleZone"
                    {...handleProps}
                    >
                    <div className="modal-handle" />
                </div>
                <div className="modal-header">
                    <div className="modal-title">History</div>
                </div>
                <div className="modal-body" id="ds-historyList">
                    <div className="week-chart ds-week-chart">
                        <div className="week-chart-bars">
                            {data7.map(day => (
                                <div key={day.date} className="week-chart-col">
                                    <div className="week-chart-bar-wrap">
                                        {goal > 0 && <div className="week-chart-goal-line" style={{ bottom: `${goalPct}%` }} />}
                                        <div className="week-chart-bar-fill" style={{ height: `${day.amount / maxAmount * 100}%` }} />
                                    </div>
                                    <div className="week-chart-val">{fmtMl(day.amount)}</div>
                                    <div className={`week-chart-day${day.label === 'Today' ? ' today' : ''}`}>{day.label}</div>
                                </div>
                            ))}
                        </div>
                        <div className="week-chart-avg-row">
                            <span>7-day avg: <strong className={averageColor.className} style={{ ['--ds-week-mix' as string]: averageColor.mix }}>{fmtMl(Math.round(average))}</strong></span>
                        </div>
                    </div>
                    {Object.keys(groups).length === 0
                        ? <div className="empty-state"><div className="empty-icon"><i className="fa-solid fa-bottle-water" /></div>No entries yet.</div>
                        : Object.entries(groups).map(([date, dayEntries]) => {
                            const totalMl = dayEntries.reduce((s, e) => s + e.amount, 0);
                            return (
                                <React.Fragment key={date}>
                                    <div className="log-date-header">
                                        {formatDateLabel(date)} <span className="log-date-total">{fmtMl(totalMl)}</span>
                                    </div>
                                    {dayEntries.map(e => (
                                        <div key={e.id} className="log-item no-anim">
                                            <div className="log-emoji no-select"><i className={e.emoji} /></div>
                                            <div className="log-info">
                                                <div className="log-name">{e.drink}</div>
                                                <div className="log-time">{fmtTime(e.ts)}</div>
                                            </div>
                                            <div className="log-amount">+{e.amount} ml</div>
                                        </div>
                                    ))}
                                </React.Fragment>
                            );
                        })
                    }
                </div>
            </div>
        </div>
    );
}
