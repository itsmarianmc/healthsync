'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../_context/AuthContext';
import { useCookieConsent } from '../../_lib/useCookieConsent';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { activeOwner, queueSettings } from '../../_lib/localData';
import { readCustomSupplements, SUPPLEMENT_KEYS } from '../../_lib/supplements';
import type { CustomSupplement, SupplementSchedule } from '../../_lib/types';
import CustomSupplementEditorModal from './CustomSupplementEditorModal';

const WEEKDAYS = [
    { value: 1, short: 'Mon' },
    { value: 2, short: 'Tue' },
    { value: 3, short: 'Wed' },
    { value: 4, short: 'Thu' },
    { value: 5, short: 'Fri' },
    { value: 6, short: 'Sat' },
    { value: 7, short: 'Sun' },
] as const;

function currentOwner(): string {
    return typeof window === 'undefined' ? 'guest' : activeOwner();
}

function formatSchedule(schedule: SupplementSchedule): string {
    if (schedule.mode === 'weekdays') {
        return WEEKDAYS.filter(day => schedule.weekdays.includes(day.value)).map(day => day.short).join(', ');
    }
    const [year, month, day] = schedule.startDate.split('-').map(Number);
    const startDate = new Date(0);
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCFullYear(year, month - 1, day);
    const formattedStart = startDate.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    });
    return `Every ${schedule.everyDays} days · starts ${formattedStart}`;
}

interface EditorRequest {
    requestId: number;
    supplement: CustomSupplement | null;
    owner: string;
}

interface CustomSupplementsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function CustomSupplementsModal({ isOpen, onClose }: CustomSupplementsModalProps) {
    const { user, retrySync, showToast } = useAuth();
    const { canUsePreferences } = useCookieConsent();
    const [supplements, setSupplements] = useState<CustomSupplement[]>(() => readCustomSupplements());
    const [editorRequest, setEditorRequest] = useState<EditorRequest | null>(null);
    const editorRequestIdRef = useRef(0);
    const listHeadingRef = useRef<HTMLHeadingElement>(null);
    const ownerRef = useRef(currentOwner());

    const handleManagerClose = useCallback(() => {
        setEditorRequest(null);
        onClose();
    }, [onClose]);
    const sheet = useDraggableSheet({ onClose: handleManagerClose });
    const {
        setModalRef,
        setOverlayRef,
        stateRef: sheetStateRef,
        open: openSheet,
        close: closeSheet,
        handleProps: sheetHandleProps,
    } = sheet;

    useEffect(() => {
        if (isOpen && canUsePreferences) openSheet();
        else if (sheetStateRef.current !== 'closed') closeSheet();
    }, [isOpen, canUsePreferences, openSheet, closeSheet, sheetStateRef]);

    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || editorRequest || sheetStateRef.current === 'closed') return;
            event.preventDefault();
            event.stopPropagation();
            closeSheet();
        };
        window.addEventListener('keydown', handleEscape, true);
        return () => window.removeEventListener('keydown', handleEscape, true);
    }, [isOpen, editorRequest, closeSheet, sheetStateRef]);

    const setManagerSubModal = useCallback((active: boolean) => {
        const overlay = document.getElementById('customSupplementsOverlay');
        const modal = overlay?.querySelector<HTMLElement>('.modal');
        if (!overlay || !modal) return;
        modal.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), scale 0.35s cubic-bezier(0.4, 0, 0.2, 1), translate 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
        void modal.offsetHeight;
        overlay.classList.toggle('has-sub-modal', active);
    }, []);

    useEffect(() => {
        setManagerSubModal(editorRequest !== null);
    }, [editorRequest, setManagerSubModal]);

    const handleEditorCloseStart = useCallback(() => {
        setManagerSubModal(false);
    }, [setManagerSubModal]);
    const activeEditorRequestId = editorRequest?.requestId ?? null;
    const handleEditorClose = useCallback(() => {
        if (activeEditorRequestId === null) return;
        setEditorRequest(current => current?.requestId === activeEditorRequestId ? null : current);
    }, [activeEditorRequestId]);

    useEffect(() => {
        if (!isOpen) return;
        listHeadingRef.current?.focus();
    }, [isOpen]);

    useEffect(() => {
        const refresh = () => {
            const nextOwner = currentOwner();
            if (ownerRef.current !== nextOwner) {
                ownerRef.current = nextOwner;
                setEditorRequest(null);
            }
            setSupplements(readCustomSupplements());
        };
        window.addEventListener('storage', refresh);
        return () => window.removeEventListener('storage', refresh);
    }, []);

    const saveDefinitions = (next: CustomSupplement[], expectedOwner: string): boolean => {
        if (!canUsePreferences || currentOwner() !== expectedOwner) {
            showToast('Supplement settings are unavailable. Reopen Settings and try again.');
            return false;
        }
        try {
            localStorage.setItem(SUPPLEMENT_KEYS.custom, JSON.stringify(next));
        } catch {
            showToast('Could not save this supplement on your device.');
            return false;
        }
        setSupplements(next);
        window.dispatchEvent(new Event('storage'));

        if (user && currentOwner() === user.id) {
            try {
                queueSettings({ custom_supplements: next });
                void retrySync();
            } catch {
                showToast('Saved on this device; cloud sync could not be queued.');
            }
        }
        return true;
    };

    const handleSaveSupplement = (supplement: CustomSupplement, expectedOwner: string): boolean => {
        const next = supplements.some(item => item.id === supplement.id)
            ? supplements.map(item => item.id === supplement.id ? supplement : item)
            : [...supplements, supplement];
        return saveDefinitions(next, expectedOwner);
    };

    const openAdd = () => {
        setManagerSubModal(true);
        setEditorRequest({ requestId: ++editorRequestIdRef.current, supplement: null, owner: currentOwner() });
    };
    const openEdit = (supplement: CustomSupplement) => {
        setManagerSubModal(true);
        setEditorRequest({ requestId: ++editorRequestIdRef.current, supplement, owner: currentOwner() });
    };

    const handleRemove = (supplement: CustomSupplement) => {
        if (!window.confirm(`Remove "${supplement.name}"? Past intake records will be kept.`)) return;
        const owner = currentOwner();
        const next = supplements.filter(item => item.id !== supplement.id);
        saveDefinitions(next, owner);
    };

    return (
        <>
            <div
                className="app-overlay"
                id="customSupplementsOverlay"
                ref={setOverlayRef}
                onClick={event => { if (event.target === event.currentTarget) closeSheet(); }}
            >
                <div
                    className="modal"
                    id="customSupplementsModal"
                    ref={setModalRef}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="customSupplementsDialogTitle"
                >
                    <div className="modal-handle-zone" id="customSupplementsHandleZone" {...sheetHandleProps}>
                        <div className="modal-handle" />
                    </div>
                    <div className="modal-header">
                        <div className="modal-title" id="customSupplementsDialogTitle" ref={listHeadingRef} tabIndex={-1} role="heading" aria-level={2}>Custom supplements</div>
                        <div className="modal-btn--right">
                            <button className="back-btn" style={{ background: 'var(--surface3)' }} title="Close custom supplements" aria-label="Close custom supplements"
                                onClick={closeSheet}>
                                <i className="fas fa-x" />
                            </button>
                        </div>
                    </div>
                    <div className="modal-body" id="customSupplementsModalBody">
                        <section className="custom-supplements-panel" aria-labelledby="customSupplementsTitle">
                            {supplements.length === 0 ? (
                                <p className="custom-supplements-empty">No custom supplements yet. Start by adding one.</p>
                            ) : (
                                <ul className="custom-supplement-list">
                                    {supplements.map(supplement => (
                                        <li className="custom-supplement-item" key={supplement.id}>
                                            <button
                                                type="button"
                                                className="custom-supplement-edit"
                                                onClick={() => openEdit(supplement)}
                                                aria-label={`Edit ${supplement.name}, ${formatSchedule(supplement.schedule)}`}
                                            >
                                                <span className="custom-supplement-edit-name">{supplement.name}</span>
                                                {supplement.dose && <span className="custom-supplement-dose">{supplement.dose}</span>}
                                                <span className="custom-supplement-schedule">{formatSchedule(supplement.schedule)}</span>
                                            </button>
                                            <button
                                                type="button"
                                                className="custom-supplement-remove"
                                                onClick={() => handleRemove(supplement)}
                                                aria-label={`Remove ${supplement.name}`}
                                            >
                                                <i className="fa-regular fa-trash-can" aria-hidden="true" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <button type="button" className="data-btn custom-supplement-add" id="addCustomSupplementBtn" onClick={openAdd}>
                                <i className="fa-solid fa-plus" aria-hidden="true" /> Add supplement
                            </button>
                        </section>
                    </div>
                </div>
            </div>

            {editorRequest && (
                <CustomSupplementEditorModal
                    key={editorRequest.requestId}
                    isOpen
                    supplement={editorRequest.supplement}
                    existingIds={supplements.map(supplement => supplement.id)}
                    expectedOwner={editorRequest.owner}
                    onCloseStart={handleEditorCloseStart}
                    onClose={handleEditorClose}
                    onSave={handleSaveSupplement}
                />
            )}
        </>
    );
}
