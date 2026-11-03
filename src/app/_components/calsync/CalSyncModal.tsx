'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { FoodEntry, FoodSearchResult, DraftChange } from '../../_lib/types';
import { useCookieConsent } from '../../_lib/useCookieConsent';
import type { Detection, DetectionMode } from '../../_context/AiDetectionContext';
import { buildFoodEntry } from '../../_lib/foodEntry';
import { logger } from '@/lib/logger';
import { describeGeminiError, toGeminiFoodSearchResult } from '../../_lib/gemini';
import { useAuth } from '../../_context/AuthContext';
import { ensureLibraryFood, isFoodFavorite, setFoodFavorite, saveLibraryFood, libraryData, resolveFood } from '../../_lib/foodLibrary';
import FoodReviewEditorSheet from './FoodReviewEditorSheet';
import { isBarcodeFood } from './foodLibraryPresentation';
import { workspaceGuard } from '../../_lib/localData';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { BEFORE_APP_RELOAD } from '../../_lib/appUpdates';
import { useSheetSteps } from '../../_hooks/useSheetSteps';
import { formatFoodNumber } from '../../_lib/foodPortions';


interface CalSyncModalProps {
    isOpen: boolean;
    onClose: (workspaceCurrent?: boolean) => void;
    onLog: (entry: FoodEntry) => Promise<{ cloudPending: boolean } | void> | { cloudPending: boolean } | void;
    onShowToast: (msg: string, dur?: number, undo?: (() => void) | null, cls?: string) => void;
    openWithAi?: 'describe' | 'import' | 'capture' | null;
    onOpenSettings?: () => void;
    prefill?: { food: FoodSearchResult; amount: number; unit: 'g' | 'ml' | 'pcs'; createdAt: number } | null;
    editingDraftId?: string | null;
    onDraftChange?: (change: DraftChange) => void;
    pendingDetection?: Detection | null;
    onDetectionResolved?: (id: string, action: 'log' | 'dismiss') => void;
    onStartDetection?: (input: { mode: DetectionMode; text?: string; file?: File }) => void;
}

type Category = { category: string; emoji: string; color: string };

function getCategoryByTime() {
    const h = new Date().getHours();
    if (h < 11) return { category: 'Breakfast', emoji: 'fa-solid fa-egg', color: '#FFD60A' };
    if (h < 15) return { category: 'Lunch', emoji: 'fa-solid fa-bowl-food', color: '#30D158' };
    if (h < 20) return { category: 'Dinner', emoji: 'fa-solid fa-utensils', color: '#E4840F' };
    return { category: 'Snack', emoji: 'fa-solid fa-cookie-bite', color: '#FF2D55' };
}

export default function CalSyncModal({
        isOpen,
        onClose,
        onLog,
        onShowToast,
        openWithAi,
        prefill,
        editingDraftId,
        onDraftChange,
        pendingDetection,
        onDetectionResolved,
        onStartDetection,
    }: CalSyncModalProps) {
    const { canUseThirdParty } = useCookieConsent();
    const { retrySync } = useAuth();
    const [editingCandidate, setEditingCandidate] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState(false);

    const [step, setStep] = useState(0);
    const { setTrackRef, painted, changing, onTransitionEnd } = useSheetSteps(step);
    const [category, setCategory] = useState<Category | null>(null);
    const [selFood, setSelFood] = useState<FoodSearchResult | null>(null);
    const [unit, setUnit] = useState<'g' | 'ml' | 'pcs'>('g');
    const [amount, setAmount] = useState(100);

    const [entryCreatedAt, setEntryCreatedAt] = useState<number | null>(null);
    const [modalState, setModalState] = useState<'closed' | 'open'>('closed');
    const [showNFT, setShowNFT] = useState(false);
    const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const [aiTextOpen, setAiTextOpen] = useState(false);
    const [aiTextValue, setAiTextValue] = useState('');
    const [, setAiProcessing] = useState(false);
    const aiImageInputRef = useRef<HTMLInputElement>(null);
    const aiCameraInputRef = useRef<HTMLInputElement>(null);
    const isModalHiddenForAiRef = useRef(false);
    const aiProcessingRef = useRef(false);
    const processingRef = useRef<HTMLDivElement>(null);
    const analyzingRef = useRef<HTMLDivElement>(null);
    const confirmRef = useRef<HTMLDivElement>(null);
    const contextRef = useRef<HTMLDivElement>(null);
    const sheet = useDraggableSheet({ onClose: () => completeClose(), additionalTransitionProperties: ['scale', 'translate'] });
    const { modalRef, overlayRef, handleProps, open, refreshHeight, close: closeSheet, stateRef: sheetStateRef } = sheet;
    const bodyRef = useRef<HTMLDivElement>(null);
    const textSheet = useDraggableSheet({ onClose: () => {
        setAiTextOpen(false);
        if (aiTextOpen && !aiProcessingRef.current) snapToClosedRef.current();
    }, initialFocus: '#aiTextInput' });
    const { open: openText, close: closeText, modalRef: textModalRef, overlayRef: textOverlayRef, handleProps: textHandleProps } = textSheet;
    const closingRef = useRef(false);
    const stepRef = useRef(0);
    const currentDetectionIdRef = useRef<string | null>(null);
    const errorMessageRef = useRef<string | null>(null);
    const loggedRef = useRef(false);
    const loggingRef = useRef(false);
    const snapToClosedRef = useRef<() => void>(() => {});
    const toastedDetectionIdRef = useRef<string | null>(null);
    const appliedResultRef = useRef<Detection['result'] | null>(null);
    const candidateGuard = useRef<() => boolean>(() => false);
    useEffect(() => {
        if (!isOpen) return;
        candidateGuard.current = workspaceGuard();
        if (modalRef.current) modalRef.current.style.visibility = '';
        const check = () => {
            if (candidateGuard.current()) return;
            if (modalRef.current) modalRef.current.style.visibility = 'hidden';
            snapToClosedRef.current();
        };
        window.addEventListener('storage', check);
        return () => window.removeEventListener('storage', check);
    }, [isOpen]);
    useEffect(() => {
        const isCurrent = workspaceGuard();
        const persist = (event: Event) => {
            if (!isOpen || !selFood || editingCandidate || editingRecipe || !isCurrent() || !candidateGuard.current()) return;
            try {
                if (!editingDraftId) {
                    const active = JSON.parse(localStorage.getItem('calsync_active_draft') || 'null');
                    if (pendingDetection && active?.id === pendingDetection.id) {
                        localStorage.setItem('calsync_active_draft', JSON.stringify({ ...active, food: selFood, amount, unit }));
                    }
                    return;
                }
                const drafts = JSON.parse(localStorage.getItem('calsync_pending') || '[]');
                if (!Array.isArray(drafts)) throw new Error('Invalid draft storage');
                const id = editingDraftId;
                const next = { id, food: selFood, amount, unit, ts: Date.now() };
                localStorage.setItem('calsync_pending', JSON.stringify([...drafts.filter(item => item.id !== id), next]));
            } catch { event.preventDefault(); }
        };
        window.addEventListener(BEFORE_APP_RELOAD, persist);
        return () => window.removeEventListener(BEFORE_APP_RELOAD, persist);
    }, [isOpen, selFood, amount, unit, editingCandidate, editingRecipe, editingDraftId, pendingDetection]);
    useEffect(() => { stepRef.current = step; }, [step]);

    const resultToFoodSearchResult = (result: NonNullable<Detection['result']>, cat: Category): FoodSearchResult => {
        return toGeminiFoodSearchResult(result, {
            name: cat.category,
            emoji: cat.emoji,
            color: cat.color,
        }) as FoodSearchResult;
    };

    const completeClose = useCallback(() => {
            const detectionId = currentDetectionIdRef.current;
            const errorMessage = errorMessageRef.current;
            currentDetectionIdRef.current = null;
            errorMessageRef.current = null;
            toastedDetectionIdRef.current = null;
            if (candidateGuard.current() && detectionId && onDetectionResolved) {
                onDetectionResolved(detectionId, loggedRef.current ? 'log' : 'dismiss');
            } else if (candidateGuard.current() && selFood && onDraftChange) {
                if (loggedRef.current && editingDraftId) {
                    onDraftChange({ type: 'delete', draftId: editingDraftId });
                } else if (loggedRef.current && !editingDraftId) {
                } else if (!loggedRef.current) {
                    if (editingDraftId) {
                        onDraftChange({ type: 'update', draftId: editingDraftId, amount, unit });
                    } else {
                        onDraftChange({
                            type: 'create',
                            draft: {
                                id: 'draft_' + Date.now().toString(36) + Math.random().toString(36).slice(2),
                                food: selFood,
                                amount,
                                unit,
                                ts: Date.now(),
                            },
                        });
                    }
                }
            }
            if (candidateGuard.current() && errorMessage && !onDetectionResolved) {
                onShowToast(errorMessage);
            }
            loggedRef.current = false;
            closingRef.current = false;
            setModalState('closed');
            resetState();
            onClose(candidateGuard.current());
    }, [onClose, selFood, amount, unit, editingDraftId, onDraftChange, onDetectionResolved, onShowToast]);
    const snapToClosed = useCallback(() => {
        if (sheetStateRef.current === 'closed') return;
        closingRef.current = true;
        closeSheet();
    }, [closeSheet, sheetStateRef]);
    const revealModal = useCallback(() => {
        isModalHiddenForAiRef.current = false;
        open();
    }, [open]);

    function resetState() {
        setEditingCandidate(false); setEditingRecipe(false);
        setStep(0); setCategory(null); setSelFood(null); setUnit('g'); setAmount(100);
        setEntryCreatedAt(null);
        setShowNFT(false);
        setAiTextOpen(false); setAiTextValue(''); setAiProcessing(false);
        setSelectedFilePreview(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
        setSelectedFile(null);
        isModalHiddenForAiRef.current = false;
        aiProcessingRef.current = false;
        toastedDetectionIdRef.current = null;
        appliedResultRef.current = null;
    };

    useEffect(() => {
        const inputs = [aiImageInputRef.current, aiCameraInputRef.current].filter(Boolean) as HTMLInputElement[];
        const onCancel = () => {
            if (stepRef.current === 0 && !aiProcessingRef.current) snapToClosedRef.current();
        };
        inputs.forEach(i => i.addEventListener('cancel', onCancel));
        return () => inputs.forEach(i => i.removeEventListener('cancel', onCancel));
    }, []);

    const getAiCategory = () => {
        return category ?? getCategoryByTime();
    };

    const handleAIError = useCallback((err: Error) => {
        aiProcessingRef.current = false;
        setAiProcessing(false);
        logger.error('AI analysis failed');
        isModalHiddenForAiRef.current = false;
        const message = describeGeminiError(err);
        errorMessageRef.current = message;
        snapToClosed();
        onShowToast(message);
        if (closingRef.current) return;
        try {
            window.dispatchEvent(new CustomEvent('extra:openBarcodeSearch', { detail: { mode: 'camera' } }));
        } catch {}
    }, [onShowToast, snapToClosed]);

    const handleImageFile = useCallback((file: File) => {
        if (!canUseThirdParty) {
            onShowToast('AI detection and Database search requires third-party consent.');
            return;
        }
        if (!file.type.startsWith('image/')) { onShowToast('Please select an image file'); return; }
        setSelectedFile(file);
        setSelectedFilePreview(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
        });
        setStep(1);
    }, [canUseThirdParty, setStep]);

    const handleCameraFile = useCallback((file: File) => {
        if (!canUseThirdParty) {
            onShowToast('AI detection requires third-party consent.');
            return;
        }
        if (!file.type.startsWith('image/')) { onShowToast('Please select an image file'); return; }
        setSelectedFile(file);
        setSelectedFilePreview(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
        });
        setStep(1);
    }, [canUseThirdParty, setStep]);

    const handleTextSubmit = useCallback(() => {
        if (!canUseThirdParty) {
            onShowToast('AI detection requires third-party consent.');
            return;
        }
        const desc = aiTextValue.trim();
        if (!desc) { onShowToast('Please enter a description'); return; }
        if (desc.length > 500) { onShowToast('Description too long (max 500 characters)'); return; }
        onShowToast('Analyzing your meal...');
        setAiTextOpen(false);
        aiProcessingRef.current = true;
        setAiProcessing(true);
        if (onStartDetection) {
            onStartDetection({ mode: 'describe', text: desc });
        }
    }, [aiTextValue, canUseThirdParty, onShowToast, onStartDetection]);

    const handleNextClick = useCallback(() => {
        if (!canUseThirdParty) {
            onShowToast('AI detection requires third-party consent.');
            return;
        }
        const text = aiTextValue.trim();
        if (!selectedFile) { onShowToast('No image selected'); return; }
        onShowToast('Analyzing your meal...');
        setAiProcessing(true);
        if (onStartDetection) {
            onStartDetection({ mode: 'import', file: selectedFile, text });
        }
        setStep(2);
    }, [canUseThirdParty, onShowToast, onStartDetection, aiTextValue, selectedFile]);

    useEffect(() => {
        if (modalState === 'closed' || closingRef.current) return;
        if (!pendingDetection) return;
        if (pendingDetection.id !== currentDetectionIdRef.current) {
            currentDetectionIdRef.current = pendingDetection.id;
        }
        if (pendingDetection.status === 'completed' && pendingDetection.result) {
            if (appliedResultRef.current === pendingDetection.result) return;
            appliedResultRef.current = pendingDetection.result;
            const cat = getAiCategory();
            if (!category) setCategory(cat);
            const food = resultToFoodSearchResult(pendingDetection.result, cat);
            const amt = pendingDetection.result.amount || 100;
            const u = (pendingDetection.result.unit || 'g') as 'g' | 'ml' | 'pcs';
            setSelFood(food);
            setUnit(u);
            setAmount(amt);
            setEntryCreatedAt(pendingDetection.startedAt);
            setShowNFT(false);
            setAiProcessing(false);
            setAiTextOpen(false);
            aiProcessingRef.current = false;
            goToStep(3);
            if (toastedDetectionIdRef.current !== pendingDetection.id) {
                toastedDetectionIdRef.current = pendingDetection.id;
            }
        } else if (pendingDetection.status === 'error') {
            if (pendingDetection.errorMessage) {
                handleAIError(new Error(pendingDetection.errorMessage));
            }
        } else if (pendingDetection.status === 'analyzing') {
            aiProcessingRef.current = true;
            setAiProcessing(true);
        } else if (pendingDetection.status === 'awaiting-file') {
            aiProcessingRef.current = false;
            setAiProcessing(false);
        }
    }, [pendingDetection?.id, pendingDetection?.status, pendingDetection?.result, pendingDetection?.errorMessage, category, onShowToast, handleAIError]);

    useEffect(() => {
        if (isOpen && modalState === 'closed') {
            if (closingRef.current) return;
            const cat = getCategoryByTime();
            const hasCompletedDetection = pendingDetection && pendingDetection.status === 'completed' && pendingDetection.result;
            const hasErroredDetection = pendingDetection && pendingDetection.status === 'error';
            const hasPrefill = !!prefill;
            const hasOpenWithAi = !!openWithAi;

            if (!hasPrefill && !hasOpenWithAi && !pendingDetection) {
                onClose();
                return;
            }

            if (hasErroredDetection) {
                onClose();
                return;
            }

            resetState();
            setAiTextOpen(openWithAi === 'describe');
            setCategory(cat);
            setStep(0);
            isModalHiddenForAiRef.current = true;
            if (!modalRef.current) return;
            setModalState('open');

            if (hasPrefill) {
                selectFoodWithAmount(prefill!.food, prefill!.amount, prefill!.unit, prefill!.createdAt);
            } else if (hasCompletedDetection) {
                const food = resultToFoodSearchResult(pendingDetection!.result!, cat);
                setSelFood(food);
                setUnit((pendingDetection!.result!.unit || 'g') as 'g' | 'ml' | 'pcs');
                setAmount(pendingDetection!.result!.amount || 100);
                setEntryCreatedAt(pendingDetection!.startedAt);
                appliedResultRef.current = pendingDetection!.result ?? null;
                setStep(3);
            }
            revealModal();
        } else if (!isOpen && modalState !== 'closed') {
            snapToClosed();
        }
    }, [isOpen, onClose, prefill, openWithAi, pendingDetection, revealModal, onShowToast]);

    useEffect(() => { refreshHeight(); }, [step, selFood, refreshHeight]);
    useEffect(() => { if (aiTextOpen) openText(); else closeText(); }, [aiTextOpen, openText, closeText]);

    function selectFoodWithAmount(food: FoodSearchResult, amt: number, u: 'g' | 'ml' | 'pcs', createdAt: number) {
        setSelFood(food);
        setUnit(u);
        setAmount(amt);
        setEntryCreatedAt(createdAt);
        setShowNFT(false);
        goToStep(3);
    };

    const toggleSelFoodFav = () => {
        if (!selFood || !candidateGuard.current()) return;
        try {
            const selectedAmount = selFood.recipeSnapshot?.recipe.yield.unit === 'serving' ? { amount: amount / 100, unit: 'serving' } : { amount, unit };
            setSelFood({ ...setFoodFavorite({ ...selFood, selectedAmount }, !isFoodFavorite(selFood)) });
            void retrySync();
        } catch { onShowToast('Could not save favorite on this device.'); }
    };

    function goToStep(n: number) { setStep(n); }

    const calcKcal = () => {
        if (!selFood) return 0;
        return selFood.kcalPer100 * amount / 100;
    };
    const calcProt = () => {
        if (!selFood) return 0;
        return selFood.protPer100 * amount / 100;
    };
    const calcCarb = () => {
        if (!selFood) return 0;
        return selFood.carbPer100 * amount / 100;
    };
    const calcFat = () => {
        if (!selFood) return 0;
        return selFood.fatPer100 * amount / 100;
    };

    const logFood = async () => {
        if (!selFood || selFood.aiRecipeCandidate || loggingRef.current || !candidateGuard.current()) return;
        loggingRef.current = true;
        try {
            buildFoodEntry(selFood, amount, unit || 'g');
            const selectedAmount = selFood.recipeSnapshot?.recipe.yield.unit === 'serving' ? { amount: amount / 100, unit: 'serving' } : { amount, unit };
            const saved = ensureLibraryFood({ ...selFood, selectedAmount, provenance: isBarcodeFood(selFood) ? 'barcode' : 'ai' }, undefined, true);
            const entry = buildFoodEntry(saved, amount, unit || 'g', entryCreatedAt ?? Date.now(), unit === 'ml');
            const outcome = await onLog(entry);
            loggedRef.current = true;
            void retrySync();
            snapToClosed();
            onShowToast(outcome?.cloudPending
                ? 'Saved locally; cloud sync will retry when online'
                : `${entry.kcal} kcal logged`);
        } catch {
            onShowToast('Could not save food locally. Please try again.');
        } finally {
            loggingRef.current = false;
        }
    };

    useEffect(() => {
        snapToClosedRef.current = snapToClosed;
    }, [snapToClosed]);

    const titles: Record<number, string> = { 0: 'Upload', 1: 'Context', 2: 'Analyzing', 3: 'Finalize' };
    const isLastStep = step === 3;
    const canNext = step === 1 && (!!selectedFilePreview || !!selFood);
    const SVG_ARROW = <svg height="25" viewBox="0 -960 960 960" width="25" fill="#ffffff"><path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z" /></svg>;
    const SVG_CHECK = <svg height="25" viewBox="0 -960 960 960" width="25" fill="#ffffff"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" /></svg>;

    const QUICK_AMOUNTS = [100, 200, 250, 330, 400, 500];

    const processingLabel = (() => {
        if (pendingDetection?.status === 'awaiting-file') return 'Waiting for files';
        if (pendingDetection?.status === 'analyzing') return 'Analyzing...';
        if (openWithAi === 'import' || openWithAi === 'capture') return 'Waiting for files';
        if (aiTextOpen) return 'Waiting for content';
        return 'Analyzing...';
    })();

    const canSelectFile = isOpen && step === 0 && !prefill && !pendingDetection && (openWithAi === 'import' || openWithAi === 'capture');
    const openAiFilePicker = () => {
        if (!canSelectFile) return;
        if (!canUseThirdParty) { onShowToast('AI detection requires third-party consent.'); return; }
        (openWithAi === 'capture' ? aiCameraInputRef : aiImageInputRef).current?.click();
    };

    return (
        <>
            <div className="app-overlay" id="appOverlay" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) snapToClosed(); }}>
                <div className="modal" id="modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="modalTitle">
                    <div className="modal-handle-zone" id="handleZone" {...handleProps}>
                        <div className="modal-handle" />
                    </div>
                    <div className="modal-header">
                        <div className="modal-title" id="modalTitle">{titles[step]}</div>
                    </div>

                    <div className="modal-body" id="modalBody" ref={bodyRef}>
                        <div className="sheet-step-track" ref={setTrackRef} data-content-changing={changing} onTransitionEnd={onTransitionEnd} style={{ display: 'flex', width: '400%', alignItems: 'flex-start', transform: `translateX(-${step * 25}%)` }}>
                            <div className="modal-step" id="cs-step-processing" ref={processingRef} inert={step !== 0} aria-hidden={step !== 0} style={{ display: 'block', width: '25%', flexShrink: 0, height: painted(0) ? 'auto' : 0, overflow: 'hidden', visibility: painted(0) ? 'visible' : 'hidden' }}>
                                <div className="search-step-inner">
                                    <input ref={aiImageInputRef} type="file" accept="image/*" tabIndex={-1} aria-hidden="true"
                                    style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0, overflow: 'hidden', pointerEvents: 'none' }}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ''; }} />
                                    <input ref={aiCameraInputRef} type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true"
                                    style={{ position: 'absolute', left: 0, top: 0, width: 1, height: 1, opacity: 0, overflow: 'hidden', pointerEvents: 'none' }}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleCameraFile(f); e.target.value = ''; }} />
                                    <div className="ai-processing" id="aiProcessing" style={{ display: 'block' }}
                                        role={canSelectFile ? 'button' : undefined} tabIndex={canSelectFile ? 0 : undefined}
                                        aria-label={canSelectFile ? (openWithAi === 'capture' ? 'Take a photo' : 'Select a photo') : undefined}
                                        onClick={openAiFilePicker} onKeyDown={e => {
                                            if (canSelectFile && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openAiFilePicker(); }
                                        }}>
                                        <div className="processing-spinner">
                                            <i className="fa-solid fa-circle-notch fa-spin" />
                                        </div>
                                        <div className="processing-text" id="csProcessingText">{processingLabel}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-step" id="cs-step-context" ref={contextRef} inert={step !== 1} aria-hidden={step !== 1} style={{ display: 'block', width: '25%', flexShrink: 0, height: painted(1) ? 'auto' : 0, overflow: 'hidden', visibility: painted(1) ? 'visible' : 'hidden' }}>
                                {(selectedFilePreview || (selFood && pendingDetection?.status !== 'completed')) && (
                                    <div className="context-step">
                                        <div className="context-image-preview">
                                            <img src={selectedFilePreview || URL.createObjectURL(new Blob())} alt={selFood?.name || 'Selected meal'} />
                                        </div>
                                        <div className="context-text-input-wrapper">
                                            <textarea
                                                placeholder="Add an optional description to improve AI accuracy."
                                                rows={2}
                                                value={aiTextValue}
                                                onChange={e => setAiTextValue(e.target.value)}
                                                className="context-text-input"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal-step" id="cs-step-analyzing" ref={analyzingRef} inert={step !== 2} aria-hidden={step !== 2} style={{ display: 'block', width: '25%', flexShrink: 0, height: painted(2) ? 'auto' : 0, overflow: 'hidden', visibility: painted(2) ? 'visible' : 'hidden' }}>
                                <div className="search-step-inner">
                                    <div className="ai-processing" id="aiProcessing" style={{ display: 'block' }}>
                                        <div className="processing-spinner">
                                            <i className="fa-solid fa-circle-notch fa-spin" />
                                        </div>
                                        <div className="processing-text" id="csProcessingText">{processingLabel}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-step" id="cs-step-finalize" ref={confirmRef} inert={step !== 3} aria-hidden={step !== 3} style={{ display: 'block', width: '25%', flexShrink: 0, height: painted(3) ? 'auto' : 0, overflow: 'hidden', visibility: painted(3) ? 'visible' : 'hidden' }}>
                                {selFood && (!pendingDetection || pendingDetection.status === 'completed') && (
                                    <div className="food-confirm-inner">
                                        <div className="food-preview-card" id="foodPreviewCard">
                                            <div className="food-preview-emoji" id="foodPreviewEmoji">
                                                <i className={selFood.emoji || 'fa-solid fa-utensils'} style={{ color: selFood.color || 'var(--accent)' }} />
                                            </div>
                                            <div className="food-preview-info">
                                                <div className="food-preview-name food-preview-name--with-favorite" id="foodPreviewName">
                                                    <span className="food-preview-name-text">{selFood.name}</span>
                                                    {!selFood.isManual && <button
                                                        type="button"
                                                        className={`food-preview-fav${isFoodFavorite(selFood) ? ' active' : ''}`}
                                                        onClick={toggleSelFoodFav}
                                                        aria-pressed={isFoodFavorite(selFood)}
                                                        aria-label={isFoodFavorite(selFood) ? 'Remove from favourites' : 'Save to favourites'}
                                                        title={isFoodFavorite(selFood) ? 'Remove from favourites' : 'Save to favourites'}
                                                    >
                                                        <i className={isFoodFavorite(selFood) ? 'fa-solid fa-star' : 'fa-regular fa-star'} aria-hidden="true" />
                                                    </button>}
                                                </div>
                                                <div className="food-preview-brand" id="foodPreviewBrand">{selFood.brand}</div>
                                                <div className="food-preview-per" id="foodPreviewPer">{selFood.recipeSnapshot?.recipe.yield.unit === 'serving' ? 'per serving' : `per 100${selFood.defaultUnit}`}</div>
                                            </div>
                                        </div>

                                        <div className="amount-section" id="amount-section">
                                            <div className="amount-label">Amount / Serving</div>
                                            <div className="amount-input-row">
                                                <input
                                                    id="amountInput"
                                                    className="amount-big-input"
                                                    min={0}
                                                    max={9999}
                                                    inputMode="decimal"
                                                    type="number"
                                                    aria-label="Food amount"
                                                    value={selFood.recipeSnapshot?.recipe.yield.unit === 'serving' ? amount / 100 : amount}
                                                    onChange={e => setAmount(Number(e.target.value) * (selFood.recipeSnapshot?.recipe.yield.unit === 'serving' ? 100 : 1))}
                                                />
                                                <div className="amount-unit-toggle">
                                                    {([selFood.defaultUnit === 'ml' ? 'ml' : 'g'] as const).map(u => (
                                                        <button
                                                            key={u}
                                                            type="button"
                                                            className={`unit-btn${unit === u ? ' active' : ''}`}
                                                            onClick={() => setUnit(u)}
                                                        >
                                                            {selFood.recipeSnapshot?.recipe.yield.unit === 'serving' ? 'servings' : u}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="quick-amounts">
                                                {QUICK_AMOUNTS.map(val => (
                                                    <button
                                                        key={val}
                                                        type="button"
                                                        className={`quick-btn${amount === val ? ' active' : ''}`}
                                                        onClick={() => setAmount(val)}
                                                    >
                                                        {selFood.recipeSnapshot?.recipe.yield.unit === 'serving' ? val / 100 : val}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="calorie-preview-row" id="caloriePreviewRow">
                                            <div className="calorie-big">
                                                <span id="calculatedCalories">{formatFoodNumber(calcKcal())}</span>
                                                <span className="calorie-unit-label">kcal</span>
                                            </div>
                                            <div className="macro-pills" id="macroPills">
                                                {(calcProt() > 0 || calcCarb() > 0 || calcFat() > 0) && (
                                                <>
                                                    <div className="macro-pill">P: {formatFoodNumber(calcProt())}g</div>
                                                    <div className="macro-pill">C: {formatFoodNumber(calcCarb())}g</div>
                                                    <div className="macro-pill">F: {formatFoodNumber(calcFat())}g</div>
                                                </>
                                                )}
                                            </div>
                                        </div>

                                        {showNFT && selFood.isBarcode && (
                                        <div className="nutrition-facts-table" id="nutritionFactsTable">
                                            <div className="nutrition-facts-header">
                                            <h3 className="nutrition-facts-title">Nutrition Facts</h3>
                                            <div className="nutrition-facts-subtitle">per 100<span id="nftUnit">{selFood.defaultUnit}</span></div>
                                            </div>
                                            <div className="nutrition-facts-body">
                                            <div className="nutrition-row nutrition-row-main"><span className="nutrition-label">Energy</span><span className="nutrition-value" id="nftEnergy">{formatFoodNumber(selFood.energyKj)} kJ / {formatFoodNumber(selFood.kcalPer100)} kcal</span></div>
                                            <div className="nutrition-row"><span className="nutrition-label">Fat</span><span className="nutrition-value"><span id="nftFat">{formatFoodNumber(selFood.fatPer100)}</span> g</span></div>
                                            <div className="nutrition-row nutrition-row-sub"><span className="nutrition-label">of which saturates</span><span className="nutrition-value" id="nftSatFat">{selFood.satFatPer100 !== null ? `${formatFoodNumber(selFood.satFatPer100)} g` : '-'}</span></div>
                                            <div className="nutrition-row"><span className="nutrition-label">Carbohydrate</span><span className="nutrition-value"><span id="nftCarbs">{formatFoodNumber(selFood.carbPer100)}</span> g</span></div>
                                            <div className="nutrition-row nutrition-row-sub"><span className="nutrition-label">of which sugars</span><span className="nutrition-value" id="nftSugar">{selFood.sugarPer100 !== null ? `${formatFoodNumber(selFood.sugarPer100)} g` : '-'}</span></div>
                                            <div className="nutrition-row"><span className="nutrition-label">Protein</span><span className="nutrition-value"><span id="nftProtein">{formatFoodNumber(selFood.protPer100)}</span> g</span></div>
                                            <div className="nutrition-row"><span className="nutrition-label">Salt</span><span className="nutrition-value" id="nftSalt">{selFood.saltPer100 !== null ? `${formatFoodNumber(selFood.saltPer100)} g` : '-'}</span></div>
                                            </div>
                                        </div>
                                        )}
                                        {!isBarcodeFood(selFood) && (
                                            <button type="button" className="option-btn" onClick={() => selFood.aiRecipeCandidate || selFood.recipeSnapshot ? setEditingRecipe(true) : setEditingCandidate(true)}>
                                                {selFood.aiRecipeCandidate ? 'Review recipe ingredients' : selFood.recipeSnapshot ? 'Edit recipe' : 'Edit food details'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer" id="modalFooter">
                        <button className="confirm-btn" id="actionBtn" disabled={!!selFood?.aiRecipeCandidate || editingRecipe || editingCandidate || (!canNext && !(isLastStep && selFood))} onClick={() => { if (canNext) handleNextClick(); else if (isLastStep && selFood) logFood(); }}>
                            <span className="btn-icon" id="actionIcon">{isLastStep ? SVG_CHECK : SVG_ARROW}</span>
                        </button>
                    </div>
                </div>

            </div>
            {selFood && (editingCandidate || editingRecipe) && <FoodReviewEditorSheet food={selFood} recipe={editingRecipe}
                onClose={() => { setEditingCandidate(false); setEditingRecipe(false); }}
                onSaveFood={food => { if (candidateGuard.current()) { setSelFood(food); setUnit(food.defaultUnit); } }}
                onSaveRecipe={food => {
                    if (!candidateGuard.current()) return;
                    saveLibraryFood({ ...food, emoji: food.emoji || selFood.emoji }); setSelFood(resolveFood(food.id, libraryData().foods));
                    setUnit(food.defaultUnit); setAmount(100); void retrySync();
                }} />}
            <div className="app-overlay" id="aiTextOverlay" ref={textOverlayRef}
                onClick={e => { if (e.currentTarget === e.target) closeText(); }}>
                <div className="modal" id="aiTextModal" ref={textModalRef} role="dialog" aria-modal="true" aria-label="Describe your meal">
                    <div className="modal-handle-zone" id="aiTextHandleZone" {...textHandleProps}>
                        <div className="modal-handle" />
                    </div>
                    <div className="modal-header">
                        <div className="modal-title">Describe your meal</div>
                    </div>
                    <div className="modal-body" id="aiTextModalBody">
                        <textarea
                            id="aiTextInput"
                            className="ai-text-input"
                            placeholder="e.g. A bowl of oatmeal with banana, a handful of almonds and a dash of honey ..."
                            rows={5}
                            value={aiTextValue}
                            onChange={e => setAiTextValue(e.target.value)}
                        />
                    </div>
                    <div className="modal-footer">
                        <button className="confirm-btn" id="aiTextSubmitBtn" onClick={handleTextSubmit}>Analyze</button>
                    </div>
                </div>
            </div>
        </>
    );
}
