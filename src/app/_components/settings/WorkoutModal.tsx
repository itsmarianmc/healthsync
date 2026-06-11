'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { useAuth } from '../../_context/AuthContext';
import { pushWorkoutSessionToCloud } from '../../_lib/sync';
import { supabase } from '../../_lib/supabase';

/* ── types ───────────────────────────────────────────────────────────────── */
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
}

interface SessionExercise {
  exerciseId: string;
  name: string;
  image: string;
  gif: string | null;
  sets: SessionSet[];
}

interface WorkoutSession {
  id: string;
  routineId: string;
  routineName: string;
  startTime: number;
  exercises: SessionExercise[];
}

interface ExerciseCacheItem {
  name: string;
  image: string;
  gif: string | null;
  category: string;
}

/* ── storage helpers ─────────────────────────────────────────────────────── */
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

/* ── exercise cache ──────────────────────────────────────────────────────── */
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
  } catch { return []; }
}

/* ── GIF modal (inline) ──────────────────────────────────────────────────── */
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

/* ── ContextMenu ─────────────────────────────────────────────────────────── */
function RoutineContextMenu({ btn, routineId, onEdit, onSort, onDelete, onClose }: {
  btn: HTMLElement;
  routineId: string;
  onEdit: (id: string) => void;
  onSort: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rect = btn.getBoundingClientRect();

  useEffect(() => {
    requestAnimationFrame(() => {
      if (ref.current) { ref.current.style.opacity = '1'; ref.current.style.transform = 'scale(1)'; ref.current.style.visibility = 'visible'; }
    });
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node) && e.target !== btn) { handleClose(); } };
    setTimeout(() => document.addEventListener('click', handler), 10);
    return () => document.removeEventListener('click', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    if (ref.current) { ref.current.style.opacity = '0'; ref.current.style.transform = 'scale(0.8)'; ref.current.style.visibility = 'hidden'; }
    setTimeout(onClose, 200);
  };

  return (
    <div ref={ref} className="routine-context-menu" style={{
      position: 'fixed', top: rect.top - 85, right: window.innerWidth - rect.right,
      left: 'auto', bottom: 'auto', zIndex: 10000,
      opacity: 0, visibility: 'hidden', transform: 'scale(0.8)',
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

/* ── SortExercisesModal ──────────────────────────────────────────────────── */
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
          <button className="back-btn" style={{ position: 'absolute', right: 24, top: 6 }} onClick={sheet.close}>
            <i className="fa-regular fa-circle-xmark" />
          </button>
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

/* ── ExerciseCard (create/edit) ──────────────────────────────────────────── */
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

/* ── CreateModal ─────────────────────────────────────────────────────────── */
function CreateModal({ editRoutine, onSave, onClose }: {
  editRoutine: Routine | null;
  onSave: (routine: Omit<Routine, 'id' | 'created_at'> & { id?: string; created_at?: string }) => void;
  onClose: () => void;
}) {
  const sheet = useDraggableSheet({ onClose });
  const [name, setName] = useState(editRoutine?.name ?? 'New Workout');
  const [exercises, setExercises] = useState<RoutineExercise[]>(
    editRoutine ? editRoutine.exercises.map(ex => ({ ...ex, sets: ex.sets.map(s => ({ ...s })) })) : []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ExerciseCacheItem[]>([]);
  const [gifModal, setGifModal] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => { sheet.open(); }, []);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const all = await loadExercisesCache();
    setSearchResults(all.filter(e => e.name.toLowerCase().includes(q.toLowerCase())).slice(0, 20));
  };

  const addExercise = (item: ExerciseCacheItem) => {
    if (exercises.find(e => e.name === item.name)) return;
    const id = item.name.replace(/\s/g, '_') + '_' + Date.now();
    setExercises(prev => [...prev, { exerciseId: id, name: item.name, image: item.image, gif: item.gif, sets: [{ reps: 8, weight: 0 }] }]);
    setSearchQuery('');
    setSearchResults([]);
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
                  value={searchQuery} onChange={e => handleSearch(e.target.value)} />
                {searchResults.length > 0 && (
                  <div className="exercise-search-results" id="exerciseSearchResultsCreate">
                    {searchResults.map(item => (
                      <div key={item.name} className="exercise-result-item" onClick={() => addExercise(item)}>
                        <img className="exercise-result-img" src={item.image}
                          onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40'; }} alt={item.name} />
                        <div className="exercise-result-info">
                          <div className="exercise-result-name">{item.name}</div>
                          <div className="exercise-result-muscle">{item.category}</div>
                        </div>
                        <i className="fa-solid fa-plus" />
                      </div>
                    ))}
                  </div>
                )}
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

/* ── ActiveSetRow ────────────────────────────────────────────────────────── */
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
              <div key={setIdx} className={`set-row${done ? ' set-done' : ''}`}>
                <div className="set-number">{setIdx + 1}</div>
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

/* ── ActiveWorkoutModal ──────────────────────────────────────────────────── */
function ActiveWorkoutModal({ session: initSession, onClose, onFinish }: {
  session: WorkoutSession;
  onClose: () => void;
  onFinish: (session: WorkoutSession) => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const handleZoneRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<WorkoutSession>(initSession);
  const [elapsed, setElapsed] = useState(0);
  const [minimized, setMinimized] = useState(false);
  const [gifModal, setGifModal] = useState<{ url: string; name: string } | null>(null);
  const dragY = useRef(0);
  const dragStartT = useRef(0);
  const isDragging = useRef(false);

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

  const finish = () => { onFinish(session); };

  const updateSet = (exIdx: number, setIdx: number, patch: Partial<SessionSet>) => {
    setSession(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) =>
        i !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, ...patch }) }
      ),
    }));
  };

  const totalSets = session.exercises.reduce((s, ex) => s + ex.sets.length, 0);
  const doneSets = session.exercises.reduce((s, ex) => s + ex.sets.filter(x => x.state === 'completed').length, 0);
  const m = Math.floor(elapsed / 60), sec = elapsed % 60;
  const timerStr = `${m}:${String(sec).padStart(2, '0')}`;

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 24px 0' }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }} id="activeWorkoutTitle">{session.routineName}</span>
            <span style={{ fontSize: 12, color: 'var(--text3)' }} id="activeWorkoutProgress">{doneSets} / {totalSets} sets done</span>
          </div>
          <div className="modal-body" id="activeWorkoutBody" style={{ padding: '0 16px 20px', overflowY: 'auto' }}>
            {session.exercises.map((ex, exIdx) => (
              <ActiveExerciseCard key={ex.exerciseId} ex={ex} exIdx={exIdx}
                onChange={updateSet} onShowGif={(url, name) => setGifModal({ url, name })} />
            ))}
          </div>
          <div className="modal-footer" id="activeWorkoutFooter">
            <button className="option-btn" id="discardWorkoutBtn" onClick={discard}>Discard&nbsp;Workout</button>
            <button className="confirm-btn" id="finishWorkoutBtn" onClick={finish}>Finish&nbsp;Workout</button>
          </div>
        </div>
      </div>

      {/* Mini bar */}
      <div id="miniWorkoutBar" className={`mini-workout-bar${minimized ? '' : ' hidden'}`}>
        <div className="mini-workout-content">
          <div className="mini-workout-icon" onClick={restore}><i className="fa-solid fa-dumbbell" /></div>
          <div className="mini-workout-info" onClick={restore}>
            <div className="mini-workout-title" id="miniWorkoutTitle">{session.routineName} - {timerStr}</div>
            <div className="mini-workout-progress" id="miniWorkoutProgress">{doneSets} / {totalSets} sets</div>
          </div>
          <div className="mini-workout-actions">
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

/* ── WorkoutModal (main list) ────────────────────────────────────────────── */
interface WorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WorkoutModal({ isOpen, onClose }: WorkoutModalProps) {
  const sheet = useDraggableSheet({ onClose });
  const { user, showToast } = useAuth();

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [contextMenu, setContextMenu] = useState<{ btn: HTMLElement; id: string } | null>(null);
  const [createModal, setCreateModal] = useState<{ edit: Routine | null } | null>(null);
  const [sortModal, setSortModal] = useState<Routine | null>(null);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);

  /* open/close */
  useEffect(() => {
    if (isOpen) {
      setRoutines(loadRoutinesFromStorage());
      sheet.open();
      setTimeout(() => sheet.snapToExpanded(), 80);
    } else if (sheet.stateRef.current !== 'closed') sheet.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const save = (list: Routine[]) => {
    saveRoutinesToStorage(list);
    setRoutines(list);
    // sync routines to cloud via user_settings.workout_routines
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

  const handleFinish = async (session: WorkoutSession) => {
    const endTime = Date.now();
    const duration = Math.floor((endTime - session.startTime) / 1000);
    const log = {
      id: session.id, routineId: session.routineId, routineName: session.routineName,
      startTime: session.startTime, endTime, duration,
      exercises: session.exercises.map(ex => ({
        exerciseId: ex.exerciseId, name: ex.name,
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
          sets: ex.sets.map(s => ({ reps: s.reps, weight: s.weight, done: s.state === 'completed' })),
        })),
      }, user.id);
    }
    const m = Math.floor(duration / 60), s = duration % 60;
    showToast(`Workout saved! ${m}:${String(s).padStart(2, '0')} min`);
    setActiveSession(null);
  };

  const getCount = (r: Routine) => ({ ex: r.exercises.length, sets: r.exercises.reduce((s, e) => s + e.sets.length, 0) });

  return (
    <>
      {/* Main routine list modal */}
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
                      <div key={r.id} className="routine-item" data-id={r.id} data-index={index}>
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
                                setContextMenu(prev => prev?.id === r.id ? null : { btn: e.currentTarget as HTMLElement, id: r.id });
                              }}>
                              <i className="fa-solid fa-ellipsis-vertical" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <RoutineContextMenu
          btn={contextMenu.btn}
          routineId={contextMenu.id}
          onEdit={id => { setCreateModal({ edit: routines.find(r => r.id === id) ?? null }); setContextMenu(null); }}
          onSort={id => { setSortModal(routines.find(r => r.id === id) ?? null); setContextMenu(null); }}
          onDelete={id => { deleteRoutine(id); setContextMenu(null); }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Create / Edit modal */}
      {createModal && (
        <CreateModal
          editRoutine={createModal.edit}
          onSave={handleSaveRoutine}
          onClose={() => setCreateModal(null)}
        />
      )}

      {/* Sort exercises modal */}
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

      {/* Active workout */}
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
