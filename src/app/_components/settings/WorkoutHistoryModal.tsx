'use client';

import React, { useState, useEffect } from 'react';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';

interface LogSet {
    weight: number;
    reps: number;
    completed: boolean;
}

interface LogExercise {
    exerciseId: string;
    name: string;
    intensity?: string;
    sets: LogSet[];
    }

interface WorkoutLog {
    id: string;
    routineId: string;
    routineName: string;
    startTime: number;
    endTime: number;
    duration: number;
    intensity?: string;
    exercises: LogExercise[];
}

function loadLogs(): WorkoutLog[] {
    try {
        return JSON.parse(localStorage.getItem('healthsync_workout_logs') || '[]');
    } catch {
        return [];
    }
}

function fmtDuration(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

interface WorkoutHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function WorkoutHistoryModal({ isOpen, onClose }: WorkoutHistoryModalProps) {
    const sheet = useDraggableSheet({ onClose });
    const [logs, setLogs] = useState<WorkoutLog[]>([]);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            setLogs(loadLogs());
            sheet.open();
            setTimeout(() => sheet.snapToExpanded(), 80);
        } else if (sheet.stateRef.current !== 'closed') {
            sheet.close();
        }
    }, [isOpen]);

    const toggle = (id: string) =>
        setExpanded(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    return (
        <div
            className="app-overlay"
            ref={sheet.overlayRef}
            onClick={e => { if (e.target === sheet.overlayRef.current) sheet.close(); }}
            role="dialog"
            aria-modal="true"
            aria-label="Workout History"
            >
            <div className="modal" id="workoutHistoryModal" ref={sheet.modalRef} style={{ transform: 'translateY(100%)' }}>
                <div className="modal-handle-zone" {...sheet.handleProps}>
                    <div className="modal-handle" />
                </div>
                <div className="modal-header">
                    <div className="modal-title">Workout History</div>
                </div>
                <div className="modal-body" id="workoutHistoryModalBody" style={{ overflowY: 'auto' }}>
                    { logs.length === 0 ? (
                        <div className="empty-state">No workouts logged yet.</div>
                    ) : (
                        logs.map(log => {
                        const isExpanded = expanded.has(log.id);
                        const doneSets = log.exercises.reduce((s, ex) => s + ex.sets.filter(x => x.completed).length, 0);
                        const totalSets = log.exercises.reduce((s, ex) => s + ex.sets.length, 0);

                        return (
                            <div key={log.id} className="workout-history-entry">
                                <div
                                    className="log-date-header"
                                    role="button"
                                    tabIndex={0}
                                    aria-expanded={isExpanded}
                                    aria-controls={`workout-history-${log.id}`}
                                    onClick={() => toggle(log.id)}
                                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(log.id); } }}
                                >
                                    <div>
                                        <span className="routine-name">{log.routineName}</span>
                                        <span className="workout-history-meta">
                                            {fmtDate(log.startTime)} · {fmtTime(log.startTime)}{log.intensity ? ` · Intensity ${log.intensity}` : ''}
                                        </span>
                                    </div>
                                    <div className="workout-history-right">
                                        <span className="log-date-total">{fmtDuration(log.duration)}</span>
                                        <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} workout-history-chevron`} aria-hidden="true" />
                                    </div>
                                </div>

                                {!isExpanded && (
                                    <div className="routine-stats" style={{ paddingLeft: 4 }}>
                                        {log.exercises.length} exercise{log.exercises.length !== 1 ? 's' : ''} · {doneSets}/{totalSets} sets completed
                                    </div>
                                )}

                                {isExpanded && (
                                    <div id={`workout-history-${log.id}`}>
                                    {log.exercises.map(ex => (
                                        <div key={ex.exerciseId} className="exercise-card workout-history-card">
                                            <div className="exercise-card-header">
                                                <span>{ex.name}</span>
                                            </div>
                                            <div className="sets-table">
                                                <div className="sets-header">
                                                    <div>Set</div>
                                                    <div>kg</div>
                                                    <div>Reps</div>
                                                    <div />
                                                </div>
                                                <div className="sets-list">
                                                    {ex.sets.map((set, si) => (
                                                        <div key={si} className={`set-row${set.completed ? ' set-done' : ''}`}>
                                                            <div className="set-number">{si + 1}</div>
                                                            <input type="number" className="active-set-weight" value={set.weight} readOnly disabled />
                                                            <input type="number" className="active-set-reps" value={set.reps} readOnly disabled />
                                                        <button className="set-check-btn set-check-done" disabled style={{ opacity: set.completed ? 1 : 0.25 }} aria-label={set.completed ? 'Set completed' : 'Set not completed'}>
                                                            <i className="fa-solid fa-check" aria-hidden="true" />
                                                        </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    </div>
                                )}
                            </div>
                        );
                    }))}
                </div>
            </div>
        </div>
    );
}
