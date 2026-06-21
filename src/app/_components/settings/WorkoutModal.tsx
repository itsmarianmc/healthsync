'use client';

import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { useAuth } from '../../_context/AuthContext';
import { pushWorkoutSessionToCloud } from '../../_lib/sync';
import { supabase } from '../../_lib/supabase';

interface ExerciseSet {
    reps: number;
    weight: number;
}

interface RoutineExercise {
    exerciseId: string;
    name: string;
    image: string;
    gif: string | null;
    sets: ExerciseSet[];
}

interface Routine {
    id: string;
    name: string;
    created_at: string;
    exercises: RoutineExercise[];
}

interface SessionSet extends ExerciseSet {
    state: 'pending' | 'active' | 'completed';
    activeStartTime: number | null;
    completedAt: number | null;
    isPR?: boolean;
}

interface ExerciseBest {
    maxWeight: number;
    maxE1RM: number;
}

function epley(weight: number, reps: number): number {
    if (!weight || !reps) return 0;
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
}

function loadExerciseBests(): Record<string, ExerciseBest> {
    try {
        const raw = localStorage.getItem('healthsync_workout_logs');
        if (!raw) return {};
        const logs = JSON.parse(raw) as Array<{
            exercises?: Array<{
                exerciseId?: string;
                sets?: Array<{ weight?: number; reps?: number; completed?: boolean }>;
            }>;
        }>;
        const bests: Record<string, ExerciseBest> = {};
        for (const log of logs) {
            for (const ex of log.exercises ?? []) {
                const key = ex.exerciseId;
                if (!key) continue;
                for (const s of ex.sets ?? []) {
                    if (!s.completed) continue;
                    const w = Number(s.weight) || 0;
                    const r = Number(s.reps) || 0;
                    if (!w || !r) continue;
                    const e = epley(w, r);
                    const cur = bests[key] ?? (bests[key] = { maxWeight: 0, maxE1RM: 0 });
                    if (w > cur.maxWeight) cur.maxWeight = w;
                    if (e > cur.maxE1RM) cur.maxE1RM = e;
                }
            }
        }
        return bests;
    } catch { return {}; }
}

interface SessionExercise {
    exerciseId: string;
    name: string;
    image: string;
    gif: string | null;
    sets: SessionSet[];
    intensity?: string;
}

interface WorkoutSession {
    id: string;
    routineId: string;
    routineName: string;
    startTime: number;
    intensity?: string;
    exercises: SessionExercise[];
}

interface ExerciseCacheItem {
    name: string;
    image: string;
    gif: string | null;
    category: string;
}

const STORAGE_KEY = 'healthsync_workouts';

function loadRoutinesFromStorage(): Routine[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : (parsed.routines || []);
    } catch { return []; }
}

function saveRoutinesToStorage(routines: Routine[]) {
    const payload = { routines, _updated_at: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

let exercisesCache: ExerciseCacheItem[] | null = null;

async function loadExercisesCache(): Promise<ExerciseCacheItem[]> {
    if (exercisesCache) return exercisesCache;
    try {
        const res = await fetch('/exercises.json');
        const data = await res.json();
        const flat: ExerciseCacheItem[] = [];
        for (const [cat, items] of Object.entries(data as Record<string, unknown[]>)) {
            for (const item of items) {
                for (const [name, details] of Object.entries(item as Record<string, { img: string; gif?: string }>)) {
                flat.push({ name, image: details.img, gif: details.gif || null, category: cat });
                }
            }
        }
        exercisesCache = flat;
        return flat;
    } 
    catch {
        return [];
    }
}

function GifModal({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const dragY = useRef(0);
    const dragging = useRef(false);

    useEffect(() => {
        requestAnimationFrame(() => {
        if (overlayRef.current) overlayRef.current.classList.add('visible');
        if (modalRef.current) {
            modalRef.current.style.transition = 'transform 0.42s cubic-bezier(0.34,1.15,0.64,1)';
            modalRef.current.style.transform = 'translateY(0)';
        }
        });
    }, []);

    const close = () => {
        if (overlayRef.current) overlayRef.current.classList.remove('visible');
        if (modalRef.current) {
        modalRef.current.style.transition = 'transform 0.36s cubic-bezier(0.4,0,0.2,1)';
        modalRef.current.style.transform = 'translateY(110%)';
        }
        setTimeout(onClose, 380);
    };

    return (
        <div className="app-overlay" ref={overlayRef} style={{ zIndex: 10001 }} onClick={e => { if (e.target === overlayRef.current) close(); }}>
            <div className="modal" ref={modalRef} style={{ transform: 'translateY(100%)' }}>
                <div className="modal-handle-zone"
                    onPointerDown={e => { dragging.current = true; dragY.current = e.clientY; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); if (modalRef.current) modalRef.current.style.transition = 'none'; }}
                    onPointerMove={e => { if (!dragging.current || !modalRef.current) return; const dy = e.clientY - dragY.current; if (dy > 0) modalRef.current.style.transform = `translateY(${dy}px)`; }}
                    onPointerUp={e => { if (!dragging.current) return; dragging.current = false; if (e.clientY - dragY.current > 80) close(); else if (modalRef.current) { modalRef.current.style.transition = 'transform 0.42s cubic-bezier(0.34,1.15,0.64,1)'; modalRef.current.style.transform = 'translateY(0)'; } }}>
                    <div className="modal-handle" />
                </div>
                <div className="modal-header"><div className="modal-title">{name}</div></div>
                <div className="modal-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px 24px' }}>
                    <video src={url} autoPlay loop muted playsInline style={{ width: '100%', borderRadius: 'var(--radius-sm)', display: 'block' }} />
                </div>
            </div>
        </div>
    );
}

function RoutineContextMenu({ rect, routineId, onEdit, onSort, onDelete, onClose }: {
        rect: DOMRect;
        routineId: string;
        onEdit: (id: string) => void;
        onSort: (id: string) => void;
        onDelete: (id: string) => void;
        onClose: () => void;
    }) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        requestAnimationFrame(() => {
            if (ref.current) {
                ref.current.style.opacity = '1';
                ref.current.style.transform = 'scale(1)';
                ref.current.style.visibility = 'visible';
            }
        });

        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (ref.current && !ref.current.contains(target)) {
                handleClose();
            }
        };

        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);

    const handleClose = () => {
        if (ref.current) {
            ref.current.style.opacity = '0';
            ref.current.style.transform = 'scale(0.8)';
            ref.current.style.visibility = 'hidden';
        }
        setTimeout(onClose, 200);
    };

    return (
        <div ref={ref} className="routine-context-menu" style={{
            position: 'fixed', top: rect.top - 85, right: window.innerWidth - rect.right,
            left: 'auto', bottom: 'auto', zIndex: 10001, transform: 'scale(0.8)',
            transformOrigin: 'bottom right', transition: 'opacity 0.2s ease, transform 0.2s ease, visibility 0.2s',
            }}>
            <div className="menu-item edit" onClick={e => { e.stopPropagation(); onEdit(routineId); handleClose(); }}>
                <i className="fa-regular fa-pen-to-square" /> Edit Routine
            </div>
            <div className="menu-item sort-exercises" onClick={e => { e.stopPropagation(); onSort(routineId); handleClose(); }}>
                <i className="fa-solid fa-arrow-up-wide-short" /> Sort Exercises
            </div>
            <div className="menu-item delete" onClick={e => { e.stopPropagation(); onDelete(routineId); handleClose(); }}>
                <i className="fa-regular fa-trash-can" /> Delete Routine
            </div>
        </div>
    );
}

function SortExercisesModal({ routine, onSave, onClose }: { routine: Routine; onSave: (exercises: RoutineExercise[]) => void; onClose: () => void }) {
    const sheet = useDraggableSheet({ onClose });
    const [exercises, setExercises] = useState<RoutineExercise[]>([...routine.exercises]);
    const dragIdx = useRef<number | null>(null);

    useEffect(() => { sheet.open(); }, []);

    return (
        <div className="app-overlay" ref={sheet.overlayRef} onClick={e => { if (e.target === sheet.overlayRef.current) sheet.close(); }}>
            <div className="modal" ref={sheet.modalRef} style={{ transform: 'translateY(100%)' }}>
                <div className="modal-handle-zone" {...sheet.handleProps}><div className="modal-handle" /></div>
                <div className="modal-header">
                    <div className="modal-title">Sort Exercises</div>
                    <div className="modal-btn--right">
                        <button className="back-btn" onClick={sheet.close}>
                            <i className="fa-regular fa-circle-xmark" />
                        </button>
                    </div>
                </div>
                <div className="modal-body" style={{ padding: '0 16px 20px' }}>
                    <div className="sort-exercises-list">
                        {exercises.map((ex, idx) => (
                            <div key={ex.exerciseId} className="sort-exercise-item" draggable
                                onDragStart={() => { dragIdx.current = idx; }}
                                onDragOver={e => e.preventDefault()}
                                onDrop={() => {
                                if (dragIdx.current === null || dragIdx.current === idx) return;
                                const next = [...exercises];
                                const [moved] = next.splice(dragIdx.current, 1);
                                next.splice(idx, 0, moved);
                                setExercises(next);
                                dragIdx.current = null;
                                }}>
                                <i className="fa-solid fa-grip-vertical drag-handle" />
                                <img src={ex.image} className="sort-exercise-img" onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40'; }} alt={ex.name} />
                                <span className="sort-exercise-name">{ex.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="confirm-btn" onClick={() => { onSave(exercises); sheet.close(); }}>Save Order</button>
                </div>
            </div>
        </div>
    );
}

function ExerciseCard({ ex, idx, onChange, onRemove, onShowGif }: {
    ex: RoutineExercise; idx: number;
    onChange: (idx: number, ex: RoutineExercise) => void;
    onRemove: (idx: number) => void;
    onShowGif: (url: string, name: string) => void;
    }) {
    const updateSet = (setIdx: number, field: 'reps' | 'weight', val: number) => {
        const sets = ex.sets.map((s, i) => i === setIdx ? { ...s, [field]: val } : s);
        onChange(idx, { ...ex, sets });
    };
    const addSet = () => onChange(idx, { ...ex, sets: [...ex.sets, { reps: 8, weight: 0 }] });
    const removeSet = (setIdx: number) => onChange(idx, { ...ex, sets: ex.sets.filter((_, i) => i !== setIdx) });

    return (
        <div className="exercise-card" data-ex-idx={idx}>
            <div className="exercise-card-header" style={ex.gif ? { cursor: 'pointer' } : {}}
                onClick={() => ex.gif && onShowGif(ex.gif, ex.name)}>
                <span>
                    <img src={ex.image} style={{ width: 24, height: 24, borderRadius: 6, verticalAlign: 'middle', marginRight: 8 }}
                        onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/24'; }} alt={ex.name} />
                    {ex.name}
                </span>
                <button className="remove-exercise-btn" onClick={e => { e.stopPropagation(); onRemove(idx); }}>
                    <i className="fa-regular fa-trash-can" />
                </button>
            </div>
            <div className="sets-table">
                <div className="sets-header"><div>Set</div><div>kg</div><div>reps</div><div /></div>
                <div className="sets-list">
                    {ex.sets.map((set, setIdx) => (
                        <div key={setIdx} className="set-row" data-setidx={setIdx}>
                            <div className="set-number">{setIdx + 1}</div>
                            <input type="number" className="set-weight" value={set.weight} placeholder="0" step={2.5} min={0}
                                onChange={e => updateSet(setIdx, 'weight', parseFloat(e.target.value) || 0)} />
                            <input type="number" className="set-reps" value={set.reps} placeholder="8" min={1} step={1}
                                onChange={e => updateSet(setIdx, 'reps', parseInt(e.target.value) || 0)} />
                            <button className="remove-set-btn" onClick={() => removeSet(setIdx)}>
                                <i className="fa-regular fa-circle-xmark" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            <button className="add-set-btn" onClick={addSet}>+ Add Set</button>
        </div>
    );
}

function CreateModal({ editRoutine, onSave, onClose }: {
    editRoutine: Routine | null;
    onSave: (routine: Omit<Routine, 'id' | 'created_at'> & { id?: string; created_at?: string }) => void;
    onClose: () => void;
    }) {
    const sheet = useDraggableSheet({ onClose });
    const [name, setName] = useState(editRoutine?.name ?? '');
    const [exercises, setExercises] = useState<RoutineExercise[]>(
        editRoutine ? editRoutine.exercises.map(ex => ({ ...ex, sets: ex.sets.map(s => ({ ...s })) })) : []
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [allExercises, setAllExercises] = useState<ExerciseCacheItem[]>([]);
    const [gifModal, setGifModal] = useState<{ url: string; name: string } | null>(null);

    useEffect(() => {
        sheet.open();
        const t = setTimeout(() => sheet.snapToExpanded(), 80);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        let cancelled = false;
        loadExercisesCache().then(list => {
            if (!cancelled) setAllExercises(list);
        });
        return () => { cancelled = true; };
    }, []);

    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matches = (item: ExerciseCacheItem) =>
        !normalizedQuery
        || item.name.toLowerCase().includes(normalizedQuery)
        || item.category.toLowerCase().includes(normalizedQuery);

    const INITIAL_LIMIT = 50;
    const renderedExercises = normalizedQuery
        ? allExercises
        : allExercises.slice(0, INITIAL_LIMIT);
    const hasMoreHidden = !normalizedQuery && allExercises.length > INITIAL_LIMIT;

    const addExercise = (item: ExerciseCacheItem) => {
        if (exercises.find(e => e.name === item.name)) return;
        const id = item.name.replace(/\s/g, '_') + '_' + Date.now();
        setExercises(prev => [...prev, { exerciseId: id, name: item.name, image: item.image, gif: item.gif, sets: [{ reps: 8, weight: 0 }] }]);
        setSearchQuery('');
    };

    const handleSave = () => {
        if (!name.trim()) return;
        if (!exercises.length) return;
        onSave({ id: editRoutine?.id, created_at: editRoutine?.created_at, name: name.trim(), exercises });
    };

    return (
        <>
            <div className="app-overlay" ref={sheet.overlayRef} onClick={e => { if (e.target === sheet.overlayRef.current) sheet.close(); }}>
                <div className="modal" ref={sheet.modalRef} style={{ transform: 'translateY(100%)' }}>
                    <div className="modal-handle-zone" {...sheet.handleProps}><div className="modal-handle" /></div>
                    <div className="modal-header">
                        <div className="modal-title">{editRoutine ? 'Edit Workout' : 'Create Workout'}</div>
                    </div>
                    <div className="modal-body" id="workoutCreateModalBody" style={{ padding: '0 16px 20px', overflowY: 'auto' }}>
                        <div className="form-row">
                            <input type="text" className="form-input" placeholder="New Workout" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="form-row">
                            <label className="form-label">Add exercises</label>
                            <div id="exerciseSearchContainerCreate">
                                <input type="text" className="form-input" id="exerciseSearchInputCreate" placeholder="Search exercise..."
                                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                                <div className="exercise-search-results" id="exerciseSearchResultsCreate">
                                    {renderedExercises.map(item => {
                                        const visible = matches(item);
                                        const alreadyAdded = exercises.some(e => e.name === item.name);
                                        return (
                                            <div
                                                key={item.name}
                                                className={`exercise-result-item${visible ? '' : ' is-hidden'}${alreadyAdded ? ' is-added' : ''}`}
                                                onClick={() => visible && !alreadyAdded && addExercise(item)}
                                                aria-hidden={!visible}
                                            >
                                                <img className="exercise-result-img" src={item.image} loading="lazy"
                                                onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40'; }} alt={item.name} />
                                                <div className="exercise-result-info">
                                                    <div className="exercise-result-name">{item.name}</div>
                                                    <div className="exercise-result-muscle">{item.category}</div>
                                                </div>
                                                <i className={`fa-solid ${alreadyAdded ? 'fa-check' : 'fa-plus'}`} />
                                            </div>
                                        );
                                    })}
                                    {hasMoreHidden && (
                                        <div className="exercise-result-more">
                                            <i className="fa-solid fa-magnifying-glass" />
                                            <span>Search for more results</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="selected-exercises" id="selectedExercisesListCreate">
                                {exercises.map((ex, idx) => (
                                    <ExerciseCard key={ex.exerciseId} ex={ex} idx={idx}
                                        onChange={(i, updated) => setExercises(prev => prev.map((e, j) => j === i ? updated : e))}
                                        onRemove={i => setExercises(prev => prev.filter((_, j) => j !== i))}
                                        onShowGif={(url, name) => setGifModal({ url, name })}
                                    />
                                ))}
                            </div>
                        </div>
                        <button className="confirm-btn" id="saveRoutineBtnCreate" style={{ marginTop: 16 }} onClick={handleSave}>
                            Save Routine
                        </button>
                    </div>
                </div>
            </div>
            {gifModal && <GifModal url={gifModal.url} name={gifModal.name} onClose={() => setGifModal(null)} />}
        </>
    );
}

function ActiveExerciseCard({ ex, exIdx, onChange, onShowGif }: {
    ex: SessionExercise; exIdx: number;
    onChange: (exIdx: number, setIdx: number, updated: Partial<SessionSet>) => void;
    onShowGif: (url: string, name: string) => void;
    }) {
    return (
        <div className="exercise-card" style={{ marginTop: 14 }}>
            <div className="exercise-card-header" style={ex.gif ? { cursor: 'pointer' } : {}}
                onClick={() => ex.gif && onShowGif(ex.gif, ex.name)}>
                <span>
                <img src={ex.image} style={{ width: 32, height: 32, borderRadius: 6, verticalAlign: 'middle', marginRight: 8 }}
                    onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/24'; }} alt={ex.name} />
                {ex.name}
                </span>
            </div>
            <div className="sets-table">
                <div className="sets-header"><div>Set</div><div>kg</div><div>reps</div><div /></div>
                <div className="sets-list">
                    {ex.sets.map((set, setIdx) => {
                        const done = set.state === 'completed';
                        const active = set.state === 'active';
                        return (
                            <div key={setIdx} className={`set-row${done ? ' set-done' : ''}${set.isPR ? ' set-pr' : ''}`}>
                                <div className="set-number">
                                    {setIdx + 1}
                                    {set.isPR && <span className="set-pr-pill" title="New personal record">PR</span>}
                                </div>
                                <input type="number" className="active-set-weight" value={set.weight} placeholder="0" step={2.5} min={0}
                                disabled={done} onChange={e => !done && onChange(exIdx, setIdx, { weight: parseFloat(e.target.value) || 0 })} />
                                <input type="number" className="active-set-reps" value={set.reps} placeholder="8" min={1} step={1}
                                disabled={done} onChange={e => !done && onChange(exIdx, setIdx, { reps: parseInt(e.target.value) || 0 })} />
                                {done
                                ? <button className="set-check-btn set-check-done" disabled><i className="fa-solid fa-check" /></button>
                                : active
                                    ? <button className="set-active-btn" onClick={() => onChange(exIdx, setIdx, { state: 'completed', completedAt: Date.now() })}>
                                        <i className="fa-regular fa-circle-check" />
                                    </button>
                                    : <button className="set-play-btn" onClick={() => onChange(exIdx, setIdx, { state: 'active', activeStartTime: Date.now() })}>
                                        <i className="fa-solid fa-play" />
                                    </button>
                                }
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

const intensityLabels: Record<number, string> = {
    1: 'Very easy, could keep going',
    2: 'Easy pace, recovery-like',
    3: 'Light effort, still comfortable',
    4: 'Moderate, steady breathing',
    5: 'Solid effort, talking is okay',
    6: 'Challenging, short phrases only',
    7: 'Hard breathing, hard to speak',
    8: 'Very hard, long rests needed',
    9: 'Near-max effort, gasping',
    10: 'Hard breathing, not being able to speak, long rests',
};

const REST_DURATION_KEY = 'healthsync_rest_seconds';
const DEFAULT_REST_SECONDS = 90;

function loadRestDuration(): number {
    if (typeof window === 'undefined') return DEFAULT_REST_SECONDS;
    const raw = window.localStorage.getItem(REST_DURATION_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_REST_SECONDS;
}

function RestTimerBar({ remaining, active, duration, onAdjust, onSkip, onStart, onDurationChange }: {
    remaining: number;
    active: boolean;
    duration: number;
    onAdjust: (delta: number) => void;
    onSkip: () => void;
    onStart: () => void;
    onDurationChange: (next: number) => void;
}) {
    const display = active ? remaining : duration;
    const mm = Math.floor(display / 60);
    const ss = String(display % 60).padStart(2, '0');
    const pct = active && duration > 0 ? Math.max(0, Math.min(100, (remaining / duration) * 100)) : 0;
    return (
        <div className={`rest-timer-bar${active ? ' active' : ''}`}>
            <div className="rest-timer-row">
                <div className="rest-timer-label">
                    <i className="fa-regular fa-clock" />
                    <span>{active ? 'Rest' : 'Rest timer'}</span>
                </div>
                <div className="rest-timer-time">{mm}:{ss}</div>
                <div className="rest-timer-actions">
                    {active ? (
                        <>
                            <button type="button" onClick={() => onAdjust(-15)} title="-15s">-15</button>
                            <button type="button" onClick={() => onAdjust(15)} title="+15s">+15</button>
                            <button type="button" onClick={onSkip} title="Skip">
                                <i className="fa-solid fa-forward" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button type="button" onClick={() => onDurationChange(duration - 15)} title="-15s">-15</button>
                            <button type="button" onClick={() => onDurationChange(duration + 15)} title="+15s">+15</button>
                            <button type="button" onClick={onStart} title="Start rest">
                                <i className="fa-solid fa-play" />
                            </button>
                        </>
                    )}
                </div>
            </div>
            {active && (
                <div className="rest-timer-track">
                    <div className="rest-timer-fill" style={{ width: `${pct}%` }} />
                </div>
            )}
        </div>
    );
}

function ActiveWorkoutModal({ session: initSession, onClose, onFinish }: {
    session: WorkoutSession;
    onClose: () => void;
    onFinish: (session: WorkoutSession, intensity: number) => void;
    }) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    const handleZoneRef = useRef<HTMLDivElement>(null);
    const contentWrapperRef = useRef<HTMLDivElement>(null);
    const [session, setSession] = useState<WorkoutSession>(initSession);
    const [elapsed, setElapsed] = useState(0);
    const [minimized, setMinimized] = useState(false);
    const [gifModal, setGifModal] = useState<{ url: string; name: string } | null>(null);
    const [ratingMode, setRatingMode] = useState(false);
    const [rating, setRating] = useState<number | null>(null);
    const [panelHeight, setPanelHeight] = useState<number | undefined>(undefined);
    const [restDuration, setRestDuration] = useState<number>(DEFAULT_REST_SECONDS);
    const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
    const [restRemaining, setRestRemaining] = useState<number>(0);
    const dragY = useRef(0);
    const dragStartT = useRef(0);
    const isDragging = useRef(false);
    const prBaselineRef = useRef<Record<string, ExerciseBest>>({});
    const sessionBestsRef = useRef<Record<string, ExerciseBest>>({});

    useEffect(() => { setRestDuration(loadRestDuration()); }, []);
    useEffect(() => { prBaselineRef.current = loadExerciseBests(); }, []);

    useEffect(() => {
        requestAnimationFrame(() => {
        if (overlayRef.current) overlayRef.current.classList.add('visible');
        if (modalRef.current) {
            modalRef.current.style.transition = 'transform 0.42s cubic-bezier(0.34,1.15,0.64,1)';
            modalRef.current.style.transform = 'translateY(0)';
        }
        });
        document.body.classList.add('modal-open');
        const t = setInterval(() => setElapsed(s => s + 1), 1000);
        return () => { clearInterval(t); document.body.classList.remove('modal-open'); };
    }, []);

    useEffect(() => {
        if (restEndsAt === null) { setRestRemaining(0); return; }
        const tick = () => {
            const left = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
            setRestRemaining(left);
            if (left <= 0) {
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([180, 60, 180]);
                setRestEndsAt(null);
            }
        };
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [restEndsAt]);

    const startRest = useCallback((seconds: number) => {
        if (seconds <= 0) { setRestEndsAt(null); return; }
        setRestEndsAt(Date.now() + seconds * 1000);
    }, []);

    const adjustRest = (delta: number) => {
        if (restEndsAt === null) return;
        const next = Math.max(0, restEndsAt + delta * 1000);
        if (next <= Date.now()) { setRestEndsAt(null); }
        else { setRestEndsAt(next); }
    };

    const skipRest = () => setRestEndsAt(null);

    const updateRestDuration = (next: number) => {
        const clamped = Math.max(15, Math.min(600, next));
        setRestDuration(clamped);
        if (typeof window !== 'undefined') window.localStorage.setItem(REST_DURATION_KEY, String(clamped));
    };

    const minimize = useCallback(() => {
        setMinimized(true);
        if (overlayRef.current) overlayRef.current.classList.remove('visible');
        document.body.classList.remove('modal-open');
        if (modalRef.current) {
        modalRef.current.style.transition = 'transform 0.36s cubic-bezier(0.4,0,0.2,1)';
        modalRef.current.style.transform = 'translateY(110%)';
        }
    }, []);

    const restore = useCallback(() => {
        setMinimized(false);
        if (overlayRef.current) overlayRef.current.classList.add('visible');
        document.body.classList.add('modal-open');
        if (modalRef.current) {
        modalRef.current.style.transition = 'transform 0.42s cubic-bezier(0.34,1.15,0.64,1)';
        modalRef.current.style.transform = 'translateY(0)';
        }
    }, []);

    const discard = () => {
        if (!confirm('Discard workout? Progress will be lost.')) return;
        if (overlayRef.current) overlayRef.current.classList.remove('visible');
        document.body.classList.remove('modal-open');
        setTimeout(onClose, 400);
    };

    const finish = () => {
        if (!ratingMode) {
            setRatingMode(true);
            return;
        }
        if (!rating) return;
        if (overlayRef.current) overlayRef.current.classList.remove('visible');
        if (modalRef.current) {
            modalRef.current.style.transition = 'transform 0.36s cubic-bezier(0.4,0,0.2,1)';
            modalRef.current.style.transform = 'translateY(110%)';
        }
        setTimeout(() => {
            onFinish({
                ...session,
                intensity: String(rating),
                exercises: session.exercises.map(ex => ({ ...ex, intensity: String(rating) })),
            }, rating);
        }, 380);
    };

    const updateSet = (exIdx: number, setIdx: number, patch: Partial<SessionSet>) => {
        setSession(prev => ({
        ...prev,
        exercises: prev.exercises.map((ex, i) => {
            if (i !== exIdx) return ex;
            return {
                ...ex,
                sets: ex.sets.map((s, j) => {
                    if (j !== setIdx) return s;
                    const next: SessionSet = { ...s, ...patch };
                    if (patch.state === 'completed' && next.weight > 0 && next.reps > 0) {
                        const baseline = prBaselineRef.current[ex.exerciseId] ?? { maxWeight: 0, maxE1RM: 0 };
                        const sessionBest = sessionBestsRef.current[ex.exerciseId] ?? { maxWeight: 0, maxE1RM: 0 };
                        const e = epley(next.weight, next.reps);
                        const beatsWeight = next.weight > baseline.maxWeight && next.weight > sessionBest.maxWeight;
                        const beatsE1RM = e > baseline.maxE1RM && e > sessionBest.maxE1RM;
                        if (beatsWeight || beatsE1RM) next.isPR = true;
                        sessionBestsRef.current[ex.exerciseId] = {
                            maxWeight: Math.max(sessionBest.maxWeight, next.weight),
                            maxE1RM: Math.max(sessionBest.maxE1RM, e),
                        };
                    }
                    return next;
                }),
            };
        }),
        }));
        if (patch.state === 'completed') startRest(restDuration);
    };

    const totalSets = session.exercises.reduce((s, ex) => s + ex.sets.length, 0);
    const doneSets = session.exercises.reduce((s, ex) => s + ex.sets.filter(x => x.state === 'completed').length, 0);
    const m = Math.floor(elapsed / 60), sec = elapsed % 60;
    const timerStr = `${m}:${String(sec).padStart(2, '0')}`;

    useLayoutEffect(() => {
        if (!contentWrapperRef.current) return;
        const activePanel = contentWrapperRef.current.querySelector<HTMLDivElement>(ratingMode ? '.intensity-panel' : '.exercises-panel');
        if (!activePanel) return;
        const height = activePanel.getBoundingClientRect().height;
        setPanelHeight(height);
    }, [ratingMode, session.exercises.length, rating, restEndsAt, restRemaining]);

    return (
        <>
            <div className="app-overlay" id="activeWorkoutOverlay" ref={overlayRef}
                onClick={e => { if (e.target === overlayRef.current) minimize(); }}>
                <div className="modal" id="activeWorkoutModal" ref={modalRef} style={{ transform: 'translateY(100%)' }}>
                    <div className="modal-handle-zone" id="activeWorkoutHandleZone" ref={handleZoneRef}
                        onPointerDown={e => {
                        isDragging.current = true; dragY.current = e.clientY; dragStartT.current = e.clientY;
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        if (modalRef.current) modalRef.current.style.transition = 'none';
                        }}
                        onPointerMove={e => {
                        if (!isDragging.current || !modalRef.current || !overlayRef.current) return;
                        const dy = Math.max(0, e.clientY - dragY.current);
                        modalRef.current.style.transform = `translateY(${dy}px)`;
                        const fade = Math.min(dy / 200, 1);
                        overlayRef.current.style.background = `rgba(0,0,0,${0.6 * (1 - fade)})`;
                        overlayRef.current.style.backdropFilter = `blur(${8 * (1 - fade)}px)`;
                        }}
                        onPointerUp={e => {
                        if (!isDragging.current) return; isDragging.current = false;
                        if (e.clientY - dragStartT.current > 120) { minimize(); }
                        else if (modalRef.current && overlayRef.current) {
                            modalRef.current.style.transition = 'transform 0.36s cubic-bezier(0.34,1.15,0.64,1)';
                            modalRef.current.style.transform = 'translateY(0)';
                            overlayRef.current.style.background = '';
                            overlayRef.current.style.backdropFilter = '';
                        }
                        }}>
                        <div className="modal-handle" />
                    </div>
                    <div className="modal-header" style={{ position: 'relative' }}>
                        <div className="modal-title" id="activeWorkoutTimer">{timerStr}</div>
                    </div>
                    <div className="modal-body" id="activeWorkoutBody" style={{ padding: '0 16px 20px', overflowY: 'auto' }}>
                        <div ref={contentWrapperRef} style={{ position: 'relative', overflow: 'hidden', width: '100%', height: panelHeight ? `${panelHeight}px` : undefined, transition: 'height 0.28s ease' }}>
                            <div style={{
                                width: '200%',
                                display: 'flex',
                                alignItems: 'flex-start',
                                transition: 'transform 0.28s ease',
                                transform: ratingMode ? 'translateX(-50%)' : 'translateX(0)',
                            }}>
                                <div className="exercises-panel" style={{ width: '50%', minWidth: 0, paddingRight: 12, height: ratingMode ? 0 : undefined, overflow: ratingMode ? 'hidden' : undefined }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                        <span style={{ fontSize: 13, color: 'var(--text2)' }} id="activeWorkoutTitle">{session.routineName}</span>
                                        <span style={{ fontSize: 12, color: 'var(--text3)' }} id="activeWorkoutProgress">{doneSets} / {totalSets} sets done</span>
                                    </div>
                                    <RestTimerBar
                                        remaining={restRemaining}
                                        active={restEndsAt !== null}
                                        duration={restDuration}
                                        onAdjust={adjustRest}
                                        onSkip={skipRest}
                                        onStart={() => startRest(restDuration)}
                                        onDurationChange={updateRestDuration}
                                    />
                                    {session.exercises.map((ex, exIdx) => (
                                    <ActiveExerciseCard key={ex.exerciseId} ex={ex} exIdx={exIdx}
                                        onChange={updateSet} onShowGif={(url, name) => setGifModal({ url, name })} />
                                    ))}
                                </div>
                                <div className="intensity-panel" style={{ width: '50%', minWidth: 0, pointerEvents: ratingMode ? 'auto' : 'none', height: ratingMode ? undefined : 0, overflow: ratingMode ? undefined : 'hidden', opacity: ratingMode ? 1 : 0, visibility: ratingMode ? 'visible' : 'hidden', transition: 'all 0.28s ease' }}>
                                    <div style={{
                                        padding: 16,
                                        borderRadius: 16,
                                        background: 'rgba(255,255,255,0.04)',
                                        minHeight: 260,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 14,
                                    }}>
                                        <div style={{ fontSize: 14, color: 'var(--text2)' }}>Select how hard the workout felt.</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                                            {Array.from({ length: 10 }, (_, i) => i + 1).map(value => (
                                                <button
                                                    key={value}
                                                    className={`confirm-btn${rating === value ? ' active' : ''}`}
                                                    style={{ padding: '10px 0', fontSize: 14 }}
                                                    onClick={() => setRating(value)}
                                                >{value}</button>
                                            ))}
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text3)', minHeight: 42 }}>
                                            {rating ? <><strong>{rating}. </strong>{intensityLabels[rating]}</> : 'Pick a rating before closing the workout.'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer" id="activeWorkoutFooter">
                        <button
                            className="option-btn"
                            id="discardWorkoutBtn"
                            onClick={discard}
                            disabled={ratingMode}
                            style={ratingMode ? { width: 0, padding: 0, minWidth: 0, opacity: 0, pointerEvents: 'none' } : undefined}
                        >Discard&nbsp;Workout</button>
                        <button
                            className="confirm-btn"
                            id="finishWorkoutBtn"
                            disabled={ratingMode && !rating}
                            onClick={finish}
                        >{ratingMode ? 'Done' : 'Finish Workout'}</button>
                    </div>
                </div>
            </div>

            <div id="miniWorkoutBar" className={`mini-workout-bar${minimized ? '' : ' hidden'}`}>
                <div className="mini-workout-content">
                    <div className="mini-workout-icon" onClick={restore}>
                        {restEndsAt !== null
                            ? <span style={{ fontSize: 13, fontWeight: 700 }}>{Math.floor(restRemaining / 60)}:{String(restRemaining % 60).padStart(2, '0')}</span>
                            : <i className="fa-solid fa-dumbbell" />}
                    </div>
                    <div className="mini-workout-info" onClick={restore}>
                        <div className="mini-workout-title" id="miniWorkoutTitle">
                            {restEndsAt !== null ? 'Resting…' : `${session.routineName} - ${timerStr}`}
                        </div>
                        <div className="mini-workout-progress" id="miniWorkoutProgress">{doneSets} / {totalSets} sets</div>
                    </div>
                    <div className="mini-workout-actions">
                        {restEndsAt !== null && (
                            <button title="Skip rest" onClick={skipRest}>
                                <i className="fa-solid fa-forward" />
                            </button>
                        )}
                        <button id="miniWorkoutFinishBtn" title="Finish" onClick={() => { if (confirm('Finish workout?')) finish(); }}>
                            <i className="fa-solid fa-check" />
                        </button>
                    </div>
                </div>
            </div>

            {gifModal && <GifModal url={gifModal.url} name={gifModal.name} onClose={() => setGifModal(null)} />}
        </>
    );
}

interface WorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WorkoutModal({ isOpen, onClose }: WorkoutModalProps) {
    const sheet = useDraggableSheet({ onClose });
    const { user, showToast } = useAuth();

    const [routines, setRoutines] = useState<Routine[]>([]);
    const [contextMenu, setContextMenu] = useState<{ rect: DOMRect; id: string } | null>(null);
    const [createModal, setCreateModal] = useState<{ edit: Routine | null } | null>(null);
    const [sortModal, setSortModal] = useState<Routine | null>(null);
    const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const positions = useRef(new Map<string, DOMRect>());

    useEffect(() => {
        if (isOpen) {
            setRoutines(loadRoutinesFromStorage());
            sheet.open();
            setTimeout(() => sheet.snapToExpanded(), 80);
        } else if (sheet.stateRef.current !== 'closed') sheet.close();
    }, [isOpen]);

    useLayoutEffect(() => {
        const next = new Map<string, DOMRect>();
        routines.forEach(routine => {
            const el = itemRefs.current.get(routine.id);
            if (el) next.set(routine.id, el.getBoundingClientRect());
        });
        if (positions.current.size) {
            routines.forEach(routine => {
                const prev = positions.current.get(routine.id);
                const nextRect = next.get(routine.id);
                if (prev && nextRect) {
                    const dx = prev.left - nextRect.left;
                    const dy = prev.top - nextRect.top;
                    if (dx || dy) {
                        const el = itemRefs.current.get(routine.id);
                        if (el) {
                            el.style.transition = 'none';
                            el.style.transform = `translate(${dx}px, ${dy}px)`;
                            requestAnimationFrame(() => {
                                if (el) {
                                    el.style.transition = 'transform 0.32s cubic-bezier(0.34, 1.15, 0.64, 1)';
                                    el.style.transform = 'translate(0, 0)';
                                }
                            });
                        }
                    }
                }
            });
        }
        positions.current = next;
    }, [routines]);

    const save = (list: Routine[]) => {
        saveRoutinesToStorage(list);
        setRoutines(list);
        if (user) {
            const payload = { routines: list, _updated_at: new Date().toISOString() };
            supabase.from('user_settings').upsert({ user_id: user.id, workout_routines: payload }, { onConflict: 'user_id' }).then(() => {});
        }
    };

    const handleSaveRoutine = (data: Omit<Routine, 'id' | 'created_at'> & { id?: string; created_at?: string }) => {
        const list = loadRoutinesFromStorage();
        if (data.id) {
            const idx = list.findIndex(r => r.id === data.id);
            if (idx !== -1) list[idx] = { ...data, id: data.id, created_at: data.created_at || new Date().toISOString() };
        } else {
            list.push({ ...data, id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8), created_at: new Date().toISOString() });
        }
        save(list);
        showToast(data.id ? 'Routine updated!' : 'Routine saved!');
        setCreateModal(null);
    };

    const deleteRoutine = (id: string) => {
        if (!confirm('Delete routine?')) return;
        const list = loadRoutinesFromStorage().filter(r => r.id !== id);
        save(list);
        showToast('Routine deleted');
    };

    const startSession = async (routine: Routine) => {
        sheet.close();
        const cache = await loadExercisesCache();
        const gifMap: Record<string, string> = {};
        cache.forEach(ex => { if (ex.gif) gifMap[ex.name] = ex.gif; });
        const session: WorkoutSession = {
            id: Date.now().toString() + '-' + Math.random().toString(36).slice(2, 8),
            routineId: routine.id,
            routineName: routine.name,
            startTime: Date.now(),
            exercises: routine.exercises.map(ex => ({
                ...ex,
                gif: ex.gif || gifMap[ex.name] || null,
                sets: ex.sets.map(s => ({ ...s, state: 'pending' as const, activeStartTime: null, completedAt: null })),
            })),
        };
        setTimeout(() => setActiveSession(session), 420);
    };

    const handleFinish = async (session: WorkoutSession, rating: number) => {
        const endTime = Date.now();
        const duration = Math.floor((endTime - session.startTime) / 1000);
        const log = {
            id: session.id, routineId: session.routineId, routineName: session.routineName,
            startTime: session.startTime, endTime, duration,
            intensity: String(rating),
            exercises: session.exercises.map(ex => ({
                exerciseId: ex.exerciseId, name: ex.name, intensity: ex.intensity ?? String(rating),
                sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps, completed: s.state === 'completed', activeStartTime: s.activeStartTime, completedAt: s.completedAt })),
            })),
        };
        const logs = JSON.parse(localStorage.getItem('healthsync_workout_logs') || '[]');
        logs.unshift(log);
        localStorage.setItem('healthsync_workout_logs', JSON.stringify(logs));
        if (user) {
            pushWorkoutSessionToCloud({
                id: log.id, routineId: log.routineId, routineName: log.routineName,
                startTime: log.startTime, endTime, duration,
                exercises: session.exercises.map(ex => ({
                exerciseId: ex.exerciseId,
                exerciseName: ex.name,
                intensity: ex.intensity ?? String(rating),
                sets: ex.sets.map(s => ({ reps: s.reps, weight: s.weight, done: s.state === 'completed' })),
                })),
            }, user.id);
        }
        const m = Math.floor(duration / 60), s = duration % 60;
        showToast(`Workout saved! ${m}:${String(s).padStart(2, '0')} min`);

        const prs: string[] = [];
        for (const ex of session.exercises) {
            const best = ex.sets.filter(set => set.isPR && set.weight > 0 && set.reps > 0)
                .reduce<{ weight: number; reps: number } | null>((acc, set) => {
                    if (!acc || set.weight > acc.weight || (set.weight === acc.weight && set.reps > acc.reps)) {
                        return { weight: set.weight, reps: set.reps };
                    }
                    return acc;
                }, null);
            if (best) prs.push(`${ex.name} ${best.weight}kg × ${best.reps}`);
        }
        if (prs.length) {
            const label = prs.length === 1 ? `New PR: ${prs[0]}` : `New PRs: ${prs.join(', ')}`;
            setTimeout(() => showToast(label), 600);
        }
        setActiveSession(null);
    };

    const getCount = (r: Routine) => ({ ex: r.exercises.length, sets: r.exercises.reduce((s, e) => s + e.sets.length, 0) });

    return (
        <>
            <div className="app-overlay" id="workoutOverlay" ref={sheet.overlayRef}
                onClick={e => { if (e.target === sheet.overlayRef.current) sheet.close(); setContextMenu(null); }}>
                <div className="modal" id="workoutModal" ref={sheet.modalRef} style={{ transform: 'translateY(100%)' }}>
                    <div className="modal-handle-zone" id="workoutHandleZone" {...sheet.handleProps}>
                        <div className="modal-handle" />
                    </div>
                    <div className="modal-header">
                        <div className="modal-title" id="workoutModalTitle">My Routines</div>
                    </div>
                    <div className="modal-body" id="workoutModalBody" style={{ padding: '0 16px 20px', overflowY: 'auto' }}>
                        <div className="add-workout" id="newRoutineBtn" onClick={() => setCreateModal({ edit: null })}>
                        <div className="add-wo-btn"><i className="fas fa-plus" /></div>
                        <div className="add-wo-text">Add new workout</div>
                        </div>
                        <div id="routineListContainer">
                            <div id="routineList" className="routine-list">
                                {routines.length === 0
                                ? <div className="empty-state">No routines yet. Create one!</div>
                                : routines.map((r, index) => {
                                    const { ex, sets } = getCount(r);
                                    return (
                                    <div key={r.id} className="routine-item" data-id={r.id} data-index={index}
                                        ref={el => { if (el) itemRefs.current.set(r.id, el); else itemRefs.current.delete(r.id); }}>
                                        <div className="routine-main">
                                        <div className="routine-info">
                                            <div className="routine-name">{r.name}</div>
                                            <div className="routine-stats">{ex} exercises, {sets} sets</div>
                                        </div>
                                        <div className="routine-actions">
                                            <button className="routine-play-btn" data-id={r.id} title="Start workout"
                                            onClick={e => { e.stopPropagation(); startSession(r); }}>
                                            <i className="fa-solid fa-play" />
                                            </button>
                                            <button className="routine-menu-btn" data-id={r.id}
                                            onClick={e => {
                                                e.stopPropagation();
                                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                setContextMenu(prev => prev?.id === r.id ? null : { rect, id: r.id });
                                            }}>
                                            <i className="fa-solid fa-ellipsis-vertical" />
                                            </button>
                                        </div>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {contextMenu && (
                <RoutineContextMenu
                rect={contextMenu.rect}
                routineId={contextMenu.id}
                onEdit={id => { setCreateModal({ edit: routines.find(r => r.id === id) ?? null }); setContextMenu(null); }}
                onSort={id => { setSortModal(routines.find(r => r.id === id) ?? null); setContextMenu(null); }}
                onDelete={id => { deleteRoutine(id); setContextMenu(null); }}
                onClose={() => setContextMenu(null)}
                />
            )}

            {createModal && (
                <CreateModal
                editRoutine={createModal.edit}
                onSave={handleSaveRoutine}
                onClose={() => setCreateModal(null)}
                />
            )}

            {sortModal && (
                <SortExercisesModal
                routine={sortModal}
                onSave={exercises => {
                    const list = loadRoutinesFromStorage().map(r => r.id === sortModal.id ? { ...r, exercises } : r);
                    save(list);
                    showToast('Exercise order saved');
                    setSortModal(null);
                }}
                onClose={() => setSortModal(null)}
                />
            )}

            {activeSession && (
                <ActiveWorkoutModal
                session={activeSession}
                onClose={() => setActiveSession(null)}
                onFinish={handleFinish}
                />
            )}
        </>
    );
}
