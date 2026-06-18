'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { useAuth } from '../../_context/AuthContext';
import { pushSettings } from '../../_lib/sync';
import { calcSupplements, SUPPLEMENT_KEYS } from '../../_lib/supplements';

type TakenMap = Record<string, Record<string, boolean>>;

type Supplement = { id: string; label: string; icon: string; goal: string };

function isoDate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function buildWeek(): { date: Date; iso: string; isToday: boolean; isFuture: boolean }[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = isoDate(today);
    const days: { date: Date; iso: string; isToday: boolean; isFuture: boolean }[] = [];
    for (let i = -3; i <= 3; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        days.push({
            date: d,
            iso: isoDate(d),
            isToday: isoDate(d) === todayIso,
            isFuture: i > 0,
        });
    }
    return days;
}

function readTaken(): TakenMap {
    try {
        const raw = localStorage.getItem(SUPPLEMENT_KEYS.taken);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function readTracking(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SUPPLEMENT_KEYS.track) === 'true';
}

function computeSupplementsList(): Supplement[] {
    const weight = parseFloat(localStorage.getItem(SUPPLEMENT_KEYS.weightKg) || '0') || 0;
    const persistedCreatine = parseFloat(localStorage.getItem(SUPPLEMENT_KEYS.creatineGoal) || '0') || 0;
    const persistedMagnesium = parseFloat(localStorage.getItem(SUPPLEMENT_KEYS.magnesiumGoal) || '0') || 0;
    const goals = (persistedCreatine > 0 && persistedMagnesium > 0)
        ? { creatine_g: persistedCreatine, magnesium_mg: persistedMagnesium }
        : calcSupplements(weight);
    if (goals) {
        return [
            { id: 'creatine', label: 'Creatine', icon: 'fa-solid fa-flask', goal: `${goals.creatine_g} g` },
            { id: 'magnesium', label: 'Magnesium', icon: 'fa-solid fa-capsules', goal: `${goals.magnesium_mg} mg` },
        ];
    }
    return [
        { id: 'creatine', label: 'Creatine', icon: 'fa-solid fa-flask', goal: '- set weight in Settings' },
        { id: 'magnesium', label: 'Magnesium', icon: 'fa-solid fa-capsules', goal: '- set weight in Settings' },
    ];
}

interface SupplementsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SupplementsModal({ isOpen, onClose }: SupplementsModalProps) {
    const sheet = useDraggableSheet({ onClose });
    const { user } = useAuth();
    const week = useMemo(buildWeek, [isOpen]);
    const [selected, setSelected] = useState<string>(() => isoDate(new Date()));
    const [taken, setTaken] = useState<TakenMap>({});
    const [supplements, setSupplements] = useState<Supplement[]>([]);
    const [trackingEnabled, setTrackingEnabled] = useState<boolean>(false);

    useEffect(() => {
        if (!isOpen) {
            if (sheet.stateRef.current !== 'closed') sheet.close();
            return;
        }

        setSelected(isoDate(new Date()));
        setTaken(readTaken());
        setTrackingEnabled(readTracking());
        setSupplements(computeSupplementsList());

        sheet.open();
        setTimeout(() => sheet.snapToExpanded(), 80);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onStorage = () => {
            setTaken(readTaken());
            setTrackingEnabled(readTracking());
            setSupplements(computeSupplementsList());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [isOpen]);

    const persist = useCallback((next: TakenMap) => {
        localStorage.setItem(SUPPLEMENT_KEYS.taken, JSON.stringify(next));
        window.dispatchEvent(new Event('storage'));
        if (user) {
            pushSettings(user.id, { supplements_taken: next }).catch(() => {});
        }
    }, [user]);

    const toggle = useCallback((suppId: string) => {
        if (!trackingEnabled) return;
        const day = week.find(d => d.iso === selected);
        if (!day || day.isFuture) return;
        const dayMap = { ...(taken[selected] || {}) };
        dayMap[suppId] = !dayMap[suppId];
        const next = { ...taken, [selected]: dayMap };
        setTaken(next);
        persist(next);
    }, [selected, week, persist, trackingEnabled, taken]);

    const selectedDay = week.find(d => d.iso === selected);
    const selectedTaken = taken[selected] || {};
    const futureSelected = !!selectedDay?.isFuture;

    const headerLabel = selectedDay
        ? selectedDay.date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
        : '';

    return (
        <div
            className="app-overlay"
            ref={sheet.overlayRef}
            onClick={e => { if (e.target === sheet.overlayRef.current) sheet.close(); }}
        >
            <div className="modal" id="supplementsModal" ref={sheet.modalRef} style={{ transform: 'translateY(100%)' }}>
                <div className="modal-handle-zone" {...sheet.handleProps}>
                    <div className="modal-handle" />
                </div>
                <div className="modal-header">
                    <div className="modal-title">Supplements</div>
                </div>
                <div className="modal-body" id="supplementsModalBody" style={{ overflowY: 'auto' }}>
                    <div className="supp-date-label">{headerLabel}</div>

                    <div className="supp-week-strip">
                        {week.map(d => {
                            const dayTaken = taken[d.iso] || {};
                            const total = supplements.length;
                            const done = supplements.reduce((n, s) => n + (dayTaken[s.id] ? 1 : 0), 0);
                            const allDone = total > 0 && done === total;
                            const cls = [
                                'supp-day',
                                d.iso === selected ? 'selected' : '',
                                d.isToday ? 'today' : '',
                                d.isFuture ? 'future' : '',
                                allDone ? 'all-done' : '',
                            ].filter(Boolean).join(' ');
                            return (
                                <button
                                    key={d.iso}
                                    type="button"
                                    className={cls}
                                    onClick={() => setSelected(d.iso)}
                                    aria-pressed={d.iso === selected}
                                >
                                    <span className="supp-day-name">{d.date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                                    <span className="supp-day-num">{d.date.getDate()}</span>
                                    <span className="supp-day-progress">{total > 0 ? `${done}/${total}` : '-'}</span>
                                </button>
                            );
                        })}
                    </div>

                    {!trackingEnabled && (
                        <div className="supp-hint">
                            <i className="fa-solid fa-circle-info" />
                            <span>Enable <strong>Track Supplements</strong> in Settings to also see goals on the dashboard.</span>
                        </div>
                    )}

                    <div className="supp-list">
                        {supplements.map(s => {
                            const checked = !!selectedTaken[s.id] && trackingEnabled;
                            const rowDisabled = futureSelected || !trackingEnabled;
                            return (
                                <label key={s.id} className={`supp-row${rowDisabled ? ' disabled' : ''}`}>
                                    <span className="supp-row-icon"><i className={s.icon} /></span>
                                    <span className="supp-row-text">
                                        <span className="supp-row-name">{s.label}</span>
                                        <span className="supp-row-goal">{s.goal}</span>
                                    </span>
                                    <input
                                        type="checkbox"
                                        className="supp-check"
                                        checked={checked}
                                        disabled={rowDisabled}
                                        onChange={() => toggle(s.id)}
                                    />
                                    <span className="supp-check-box" aria-hidden="true">✓</span>
                                </label>
                            );
                        })}
                    </div>

                    {futureSelected && (
                        <p className="supp-hint">
                            <i className="fa-solid fa-clock" />
                            <span>You can&apos;t mark supplements for a future day.</span>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
