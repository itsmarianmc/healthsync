'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { generateId } from '../../_lib/ids';
import { isSupplementDue } from '../../_lib/supplements';
import type { CustomSupplement, SupplementSchedule } from '../../_lib/types';

const WEEKDAYS = [
    { value: 1, short: 'M', label: 'Monday' },
    { value: 2, short: 'T', label: 'Tuesday' },
    { value: 3, short: 'W', label: 'Wednesday' },
    { value: 4, short: 'T', label: 'Thursday' },
    { value: 5, short: 'F', label: 'Friday' },
    { value: 6, short: 'S', label: 'Saturday' },
    { value: 7, short: 'S', label: 'Sunday' },
] as const;

function localTodayISO(): string {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${month}-${day}`;
}

interface CustomSupplementEditorModalProps {
    isOpen: boolean;
    supplement: CustomSupplement | null;
    existingIds: string[];
    expectedOwner: string;
    onCloseStart: () => void;
    onClose: () => void;
    onSave: (supplement: CustomSupplement, expectedOwner: string) => boolean;
}

export default function CustomSupplementEditorModal({
    isOpen,
    supplement,
    existingIds,
    expectedOwner,
    onCloseStart,
    onClose,
    onSave,
}: CustomSupplementEditorModalProps) {
    const sheet = useDraggableSheet({ onClose });
    const {
        setModalRef,
        setOverlayRef,
        stateRef: sheetStateRef,
        open: openSheet,
        close: closeSheet,
        refreshHeight: refreshSheetHeight,
        handleProps: sheetHandleProps,
    } = sheet;
    const closeEditor = useCallback(() => {
        onCloseStart();
        closeSheet();
    }, [closeSheet, onCloseStart]);
    const [name, setName] = useState(() => supplement?.name ?? '');
    const [dose, setDose] = useState(() => supplement?.dose ?? '');
    const [scheduleMode, setScheduleMode] = useState<'weekdays' | 'interval'>(() => supplement?.schedule.mode ?? 'weekdays');
    const [weekdays, setWeekdays] = useState<number[]>(() =>
        supplement?.schedule.mode === 'weekdays' ? [...supplement.schedule.weekdays] : [],
    );
    const [everyDays, setEveryDays] = useState(() =>
        supplement?.schedule.mode === 'interval' ? String(supplement.schedule.everyDays) : '2',
    );
    const [startDate, setStartDate] = useState(() =>
        supplement?.schedule.mode === 'interval' ? supplement.schedule.startDate : localTodayISO(),
    );
    const [formError, setFormError] = useState('');
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) openSheet();
        else if (sheetStateRef.current !== 'closed') closeSheet();
    }, [isOpen, openSheet, closeSheet, sheetStateRef]);

    useEffect(() => {
        refreshSheetHeight();
    }, [scheduleMode, formError, refreshSheetHeight]);

    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            if (sheetStateRef.current !== 'closed') closeEditor();
        };
        window.addEventListener('keydown', handleEscape, true);
        return () => window.removeEventListener('keydown', handleEscape, true);
    }, [isOpen, closeEditor, sheetStateRef]);

    useEffect(() => {
        if (!isOpen) return;
        const frame = requestAnimationFrame(() => {
            requestAnimationFrame(() => nameInputRef.current?.focus());
        });
        return () => cancelAnimationFrame(frame);
    }, [isOpen]);

    const handleSave = () => {
        const cleanName = name.trim();
        const cleanDose = dose.trim();
        if (!cleanName) { setFormError('Enter a name.'); return; }

        let schedule: SupplementSchedule;
        if (scheduleMode === 'weekdays') {
            if (weekdays.length === 0) { setFormError('Select at least one day.'); return; }
            schedule = { mode: 'weekdays', weekdays: [...weekdays].sort((a, b) => a - b) };
        } else {
            const interval = Number(everyDays);
            if (!Number.isSafeInteger(interval) || interval < 2) {
                setFormError('Choose a whole number of at least 2 days.');
                return;
            }
            if (!isSupplementDue({ mode: 'interval', everyDays: interval, startDate }, startDate)) {
                setFormError('Choose a valid start date.');
                return;
            }
            schedule = { mode: 'interval', everyDays: interval, startDate };
        }

        let id = supplement?.id;
        if (!id) {
            const knownIds = new Set(existingIds);
            do { id = generateId('supp'); } while (knownIds.has(id));
        }
        const definition: CustomSupplement = {
            id,
            name: cleanName,
            ...(cleanDose ? { dose: cleanDose } : {}),
            schedule,
        };
        if (onSave(definition, expectedOwner)) {
            setFormError('');
            closeEditor();
        }
    };

    const title = supplement ? 'Edit supplement' : 'Add supplement';

    return (
        <div
            className="app-overlay"
            id="customSupplementEditorOverlay"
            ref={setOverlayRef}
            onClick={event => { if (event.target === event.currentTarget) closeEditor(); }}
        >
            <div
                className="modal"
                id="customSupplementEditorModal"
                ref={setModalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="customSupplementEditorDialogTitle"
            >
                <div className="modal-handle-zone" id="customSupplementEditorHandleZone" {...sheetHandleProps}>
                    <div className="modal-handle" />
                </div>
                <div className="modal-header">
                    <div className="modal-title" id="customSupplementEditorDialogTitle" tabIndex={-1} role="heading" aria-level={2}>{title}</div>
                    <div className="modal-btn--right">
                        <button className="back-btn" style={{ background: 'var(--surface3)' }} title="Close editor" aria-label="Close editor"
                            onClick={closeEditor}>
                            <i className="fas fa-x" />
                        </button>
                    </div>
                </div>
                <div className="modal-body" id="customSupplementEditorModalBody">
                    <section className="custom-supplements-panel">
                        <div className="custom-supplement-field">
                            <label className="form-label" htmlFor="customSupplementName">Name</label>
                            <input
                                ref={nameInputRef}
                                className="form-input"
                                id="customSupplementName"
                                type="text"
                                maxLength={80}
                                value={name}
                                onChange={event => setName(event.target.value)}
                                required
                            />
                        </div>
                        <div className="custom-supplement-field">
                            <label className="form-label" htmlFor="customSupplementDose">Amount (optional)</label>
                            <input
                                className="form-input"
                                id="customSupplementDose"
                                type="text"
                                maxLength={80}
                                value={dose}
                                onChange={event => setDose(event.target.value)}
                            />
                        </div>

                        <div className="custom-supplement-field">
                            <span className="form-label" id="customSupplementScheduleLabel">Schedule</span>
                            <div className="custom-supplement-mode" role="group" aria-labelledby="customSupplementScheduleLabel">
                                <button
                                    type="button"
                                    className={`option-btn${scheduleMode === 'weekdays' ? ' active' : ''}`}
                                    aria-pressed={scheduleMode === 'weekdays'}
                                    onClick={() => { setScheduleMode('weekdays'); setFormError(''); }}
                                >Days</button>
                                <button
                                    type="button"
                                    className={`option-btn${scheduleMode === 'interval' ? ' active' : ''}`}
                                    aria-pressed={scheduleMode === 'interval'}
                                    onClick={() => { setScheduleMode('interval'); setFormError(''); }}
                                >Interval</button>
                            </div>
                        </div>

                        {scheduleMode === 'weekdays' ? (
                            <div className="custom-supplement-field">
                                <span className="form-label" id="customSupplementDaysLabel">Days</span>
                                <div className="custom-supplement-weekdays" role="group" aria-labelledby="customSupplementDaysLabel">
                                    {WEEKDAYS.map(day => {
                                        const selected = weekdays.includes(day.value);
                                        return (
                                            <button
                                                type="button"
                                                key={day.value}
                                                className={`option-btn custom-supplement-weekday${selected ? ' active' : ''}`}
                                                aria-label={day.label}
                                                aria-pressed={selected}
                                                onClick={() => {
                                                    setWeekdays(current => selected
                                                        ? current.filter(value => value !== day.value)
                                                        : [...current, day.value]);
                                                    setFormError('');
                                                }}
                                            >{day.short}</button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="custom-supplement-field">
                                <div className="custom-supplement-interval">
                                    <label htmlFor="customSupplementEveryDays">Every</label>
                                    <input
                                        className="form-input"
                                        id="customSupplementEveryDays"
                                        type="number"
                                        inputMode="numeric"
                                        min={2}
                                        step={1}
                                        value={everyDays}
                                        onChange={event => setEveryDays(event.target.value)}
                                    />
                                    <span>days</span>
                                </div>
                                <div className="custom-supplement-start-date">
                                    <label className="form-label" htmlFor="customSupplementStartDate">Start date</label>
                                    <input
                                        className="form-input"
                                        id="customSupplementStartDate"
                                        type="date"
                                        value={startDate}
                                        onChange={event => setStartDate(event.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {formError && <p className="custom-supplement-error" role="alert">{formError}</p>}
                        <div className="custom-supplement-actions">
                            <button type="button" className="option-btn" onClick={closeEditor}>Cancel</button>
                            <button type="button" className="option-btn active" id="saveCustomSupplementBtn" onClick={handleSave}>
                                Save supplement
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
