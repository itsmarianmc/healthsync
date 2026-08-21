'use client';

import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import type { FoodEntry, FoodSearchResult, DraftChange } from '../../_lib/types';
import { useCookieConsent } from '../../_lib/useCookieConsent';
import type { Detection, DetectionMode } from '../../_context/AiDetectionContext';
import { generateEntryId } from '../../_lib/ids';
import { logger } from '@/lib/logger';

const FAVS_KEY   = 'calsync_favourites';
const EASE = 'cubic-bezier(0.34, 1.15, 0.64, 1)';
const SHEET_TOP_MARGIN = 24;

function getSafeAreaTop(): number {
  if (typeof window === 'undefined') return 0;
  const style = getComputedStyle(document.documentElement);
  const val = style.getPropertyValue('--sat') || style.getPropertyValue('env(safe-area-inset-top)');
  const px = parseFloat(val);
  return isNaN(px) ? 0 : px;
}

function loadFavs(): FoodSearchResult[] {
    try { return JSON.parse(localStorage.getItem(FAVS_KEY) || '[]'); } catch { return []; }
}
function saveFav(food: FoodSearchResult) {
    const favs = loadFavs();
    if (favs.some(f => f.name === food.name && f.brand === food.brand)) return false;
    favs.unshift({ ...food, isFavourite: true });
    localStorage.setItem(FAVS_KEY, JSON.stringify(favs.slice(0, 50)));
    return true;
}
function removeFav(name: string, brand: string) {
    localStorage.setItem(FAVS_KEY, JSON.stringify(loadFavs().filter(f => !(f.name === name && f.brand === brand))));
}
function isFav(name: string, brand: string) {
    return loadFavs().some(f => f.name === name && f.brand === brand);
}

interface CalSyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLog: (entry: FoodEntry) => void;
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
        onOpenSettings,
        prefill,
        editingDraftId,
        onDraftChange,
        pendingDetection,
        onDetectionResolved,
        onStartDetection,
    }: CalSyncModalProps) {
    const { canUseThirdParty } = useCookieConsent();

    const [step, setStep] = useState(0);
    const [category, setCategory] = useState<Category | null>(null);
    const [selFood, setSelFood] = useState<FoodSearchResult | null>(null);
    const [unit, setUnit] = useState<'g' | 'ml' | 'pcs'>('g');
    const [amount, setAmount] = useState(100);
    const [entryCreatedAt, setEntryCreatedAt] = useState<number | null>(null);
    const [favs, setFavs] = useState<FoodSearchResult[]>([]);
    const [, forceUpdate] = useState(0);
    const [modalState, setModalState] = useState<'closed' | 'open' | 'expanded'>('closed');
    const [showNFT, setShowNFT] = useState(false);
    const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const [aiTextOpen, setAiTextOpen] = useState(false);
    const [aiTextValue, setAiTextValue] = useState('');
    const [aiProcessing, setAiProcessing] = useState(false);
    const aiImageInputRef = useRef<HTMLInputElement>(null);
    const aiCameraInputRef = useRef<HTMLInputElement>(null);
    const isModalHiddenForAiRef = useRef(false);
    const aiProcessingRef = useRef(false);
    const processingRef = useRef<HTMLDivElement>(null);
    const analyzingRef = useRef<HTMLDivElement>(null);
    const confirmRef = useRef<HTMLDivElement>(null);
    const contextRef = useRef<HTMLDivElement>(null);
    const bodyHRef = useRef(0);
    const modalRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<HTMLDivElement>(null);
    const naturalH = useRef(0);
    const chromeHRef = useRef(0);
    const dragStartY = useRef(0);
    const dragDY = useRef(0);
    const vel = useRef(0);
    const dragLastY = useRef(0);
    const lastTime = useRef(0);
    const isCapturing = useRef(false);
    const prevAiTextOpenRef = useRef(false);
    const closingRef = useRef(false);
    const dispatchedForRef = useRef<'describe' | 'import' | 'capture' | null>(null);
    const stepRef = useRef(0);
    const currentDetectionIdRef = useRef<string | null>(null);
    const errorMessageRef = useRef<string | null>(null);
    const loggedRef = useRef(false);
    const snapToClosedRef = useRef<() => void>(() => {});
    const toastedDetectionIdRef = useRef<string | null>(null);
    const appliedResultRef = useRef<Detection['result'] | null>(null);
    const skipStepTransitionRef = useRef(false);
    useEffect(() => { stepRef.current = step; }, [step]);

    const expandedH = () => window.innerHeight - SHEET_TOP_MARGIN - getSafeAreaTop();
    const setNoTrans = () => { if (modalRef.current) modalRef.current.style.transition = 'none'; };
    const setTrans = (props: string[]) => { if (modalRef.current) modalRef.current.style.transition = props.map(p => `${p} 0.42s ${EASE}`).join(', '); };

    useLayoutEffect(() => {
        return () => {
            setModalState('closed');
        };
    }, []);

    const snapToOpen = useCallback(() => {
        setModalState('open');
        setTrans(['height', 'transform']);
        if (!modalRef.current || !bodyRef.current) return;
        if (chromeHRef.current > 0 && bodyHRef.current > 0) {
            naturalH.current = chromeHRef.current +  bodyHRef.current;
        }
        modalRef.current.style.height = naturalH.current + 'px';
        modalRef.current.style.transform = 'translateY(0)';
        if (bodyHRef.current > 0) bodyRef.current.style.height = bodyHRef.current + 'px';
    }, []);

    const snapToExpanded = useCallback(() => {
        setModalState('expanded');
        setTrans(['height', 'transform']);
        if (modalRef.current) { modalRef.current.style.height = expandedH() + 'px'; modalRef.current.style.transform = 'translateY(0)'; }
    }, []);

    const buildFoodEntry = (food: FoodSearchResult, amt: number, u: 'g' | 'ml' | 'pcs'): FoodEntry => {
        const kcal = Math.round(food.kcalPer100 * amt / 100);
        const prot = Math.round(food.protPer100 * amt / 100 * 10) / 10;
        const carb = Math.round(food.carbPer100 * amt / 100 * 10) / 10;
        const fat  = Math.round(food.fatPer100  * amt / 100 * 10) / 10;
        const ts = entryCreatedAt ?? Date.now();
        return {
            id: generateEntryId(),
            food: food.name,
            brand: food.brand || '',
            emoji: food.emoji || 'fa-solid fa-utensils',
            color: food.color || 'var(--accent)',
            kcal,
            amount: Math.round(amt),
            unit: u || 'g',
            prot,
            carb,
            fat,
            ts,
            date: new Date(ts).toDateString(),
            isDrink: false,
            isBarcode: !!food.isBarcode,
            barcode: food.barcode || undefined,
        };
    };

    const resultToFoodSearchResult = (result: NonNullable<Detection['result']>, cat: Category): FoodSearchResult => {
        const amt = result.amount || 100;
        return {
            name: result.name || cat.category,
            brand: result.brand || 'AI Detection',
            kcalPer100: amt > 0 ? Math.round(result.calories / amt * 100 * 10) / 10 : 0,
            protPer100: amt > 0 ? Math.round(result.protein / amt * 100 * 10) / 10 : 0,
            carbPer100: amt > 0 ? Math.round(result.carbs   / amt * 100 * 10) / 10 : 0,
            fatPer100:  amt > 0 ? Math.round(result.fat     / amt * 100 * 10) / 10 : 0,
            emoji: cat.emoji,
            color: cat.color,
            defaultUnit: (result.unit as 'g' | 'ml') || 'g',
            servingSize: amt,
            isManual: false,
            isBarcode: false,
        };
    };

    const snapToClosed = useCallback(() => {
        if (!modalRef.current || closingRef.current) return;
        closingRef.current = true;
        setModalState('closed');
        const curH = modalRef.current.offsetHeight;
        setNoTrans();
        modalRef.current.style.height = curH + 'px';
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!modalRef.current) return;
            modalRef.current.style.transition = 'transform 0.36s cubic-bezier(0.4,0,0.2,1)';
            modalRef.current.style.transform = 'translateY(110%)';
            document.body.classList.remove('modal-open');
        }));
        if (overlayRef.current) overlayRef.current.classList.remove('visible');
        setTimeout(() => {
            if (!modalRef.current) return;
            modalRef.current.style.transform = '';
            modalRef.current.style.height = '';
            modalRef.current.style.transition = '';
            naturalH.current = 0;
            const detectionId = currentDetectionIdRef.current;
            const errorMessage = errorMessageRef.current;
            dispatchedForRef.current = null;
            currentDetectionIdRef.current = null;
            errorMessageRef.current = null;
            toastedDetectionIdRef.current = null;
            if (detectionId && onDetectionResolved) {
                onDetectionResolved(detectionId, loggedRef.current ? 'log' : 'dismiss');
            } else if (selFood && onDraftChange) {
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
            if (errorMessage && !onDetectionResolved) {
                onShowToast(errorMessage);
            }
            loggedRef.current = false;
            closingRef.current = false;
            resetState();
            onClose();
        }, 440);
    }, [onClose, selFood, amount, unit, editingDraftId, onDraftChange, onDetectionResolved, onShowToast]);

    const revealModal = useCallback(() => {
        if (!isModalHiddenForAiRef.current) return;
        isModalHiddenForAiRef.current = false;
        if (overlayRef.current) overlayRef.current.classList.add('visible');
        document.body.classList.add('modal-open');
        if (modalRef.current) {
        modalRef.current.style.transition = `transform 0.42s ${EASE}`;
        modalRef.current.style.transform = 'translateY(0)';
        }
    }, []);

    const resetState = () => {
        setStep(0); setCategory(null); setSelFood(null); setUnit('g'); setAmount(100);
        setEntryCreatedAt(null);
        setShowNFT(false);
        setFavs(loadFavs());
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
            if (isModalHiddenForAiRef.current && !aiProcessingRef.current) snapToClosedRef.current();
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
        errorMessageRef.current = err.message;
        snapToClosed();
        if (err.message === 'quota') onShowToast('API quota exceeded. Try again later.');
        else if (err.message === 'no_json') onShowToast('AI returned an unreadable response. Try again.');
        else if (err.message.startsWith('api_error')) onShowToast('AI service error. Try again in a moment.');
        else if (err.message === 'No API key configured') onShowToast('No API key configured. Add one in Settings.');
        else onShowToast('AI detection cancelled. Try scanning a barcode instead.');
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

    const MODAL_BODY_PADDING_TOP = 55;

    const measureChrome = useCallback((): number => {
        if (!modalRef.current || !bodyRef.current) return 0;
        const prevDisplay = bodyRef.current.style.display;
        bodyRef.current.style.display = 'none';
        const chromeH = modalRef.current.offsetHeight;
        bodyRef.current.style.display = prevDisplay;
        return chromeH;
    }, []);

    const setupModalForOpen = useCallback((initialStep: 0 | 1, targetStepHeight: number, onStep2?: () => void) => {
        if (!modalRef.current || !bodyRef.current) return;
        const chromeH = measureChrome();
        chromeHRef.current = chromeH;
        const fullBodyH = targetStepHeight + MODAL_BODY_PADDING_TOP;
        bodyHRef.current = fullBodyH;
        naturalH.current = chromeH + fullBodyH;
        bodyRef.current.style.height = fullBodyH + 'px';
        modalRef.current.style.height = naturalH.current + 'px';
        if (initialStep === 1 && onStep2) {
            setStep(1);
            onStep2();
        }
    }, [measureChrome]);

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
            setCategory(cat);
            setStep(0);
            isModalHiddenForAiRef.current = true;
            if (!modalRef.current) return;
            setModalState('open');
            setNoTrans();
            modalRef.current.style.height = 'auto';
            modalRef.current.style.transform = 'translateY(100%)';

            const onStep2Callback = (): void => {
                skipStepTransitionRef.current = true;
                if (hasPrefill) {
                    selectFoodWithAmount(prefill!.food, prefill!.amount, prefill!.unit, prefill!.createdAt);
                } else if (hasCompletedDetection) {
                    const food = resultToFoodSearchResult(pendingDetection!.result!, cat);
                    const amt = pendingDetection!.result!.amount || 100;
                    const u = (pendingDetection!.result!.unit || 'g') as 'g' | 'ml' | 'pcs';
                    setSelFood(food);
                    setUnit(u);
                    setAmount(amt);
                    setEntryCreatedAt(pendingDetection!.startedAt);
                    appliedResultRef.current = pendingDetection!.result ?? null;
                    setStep(3);
                    if (toastedDetectionIdRef.current !== pendingDetection!.id) {
                        toastedDetectionIdRef.current = pendingDetection!.id;
                    }
                }
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    skipStepTransitionRef.current = false;
                }));
            };

            if (hasPrefill || hasCompletedDetection) {
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (!modalRef.current || !bodyRef.current) return;
                    const confirmH = confirmRef.current?.offsetHeight ?? 0;
                    setupModalForOpen(1, confirmH, onStep2Callback);
                    revealModal();
                }));
                return;
            }

            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (!modalRef.current || !bodyRef.current) return;
                const procH = processingRef.current?.offsetHeight ?? 0;
                setupModalForOpen(0, procH);
                revealModal();
            }));
        } else if (!isOpen && modalState !== 'closed') {
            snapToClosed();
        }
    }, [isOpen, onClose, prefill, openWithAi, pendingDetection, measureChrome, setupModalForOpen, onShowToast]);

    useEffect(() => {
        if (!modalRef.current || !bodyRef.current || modalState === 'closed') return;
        if (naturalH.current === 0) return;
        const refs = [processingRef, contextRef, analyzingRef, confirmRef];
        const el = refs[step].current;
        if (!el) return;
        const newStepH = el.offsetHeight;
        if (newStepH === 0) return;
        const newBodyH = newStepH + MODAL_BODY_PADDING_TOP;
        bodyHRef.current = newBodyH;
        if (chromeHRef.current > 0) naturalH.current = chromeHRef.current + newBodyH;
        if (modalState === 'expanded') return;
        bodyRef.current.style.transition = 'height 0.38s cubic-bezier(0.4,0,0.2,1)';
        bodyRef.current.style.height = newBodyH + 'px';
        modalRef.current.style.transition = `height 0.38s cubic-bezier(0.4,0,0.2,1), transform 0.42s ${EASE}`;
        modalRef.current.style.height = naturalH.current + 'px';
        setTimeout(() => {
            if (bodyRef.current) bodyRef.current.style.transition = '';
            if (modalRef.current) modalRef.current.style.transition = '';
        }, 440);
    }, [step, selFood, modalState]);

    useEffect(() => {
        if (step >= 1 && isModalHiddenForAiRef.current) {
            revealModal();
        }
    }, [step, revealModal]);

    useEffect(() => {
        const wasOpen = prevAiTextOpenRef.current;
        prevAiTextOpenRef.current = aiTextOpen;
        if (!aiTextOpen && wasOpen) {
            if (!aiProcessingRef.current) {
                setTimeout(() => { 
                    snapToClosed();
                }, 250);
            }
        }
    }, [aiTextOpen, snapToClosed]);

    useEffect(() => {
        if (!bodyRef.current) return;
        bodyRef.current.style.overflowY = step === 1 ? 'auto' : 'hidden';
    }, [step]);

    const handlePointerDown = (e: React.PointerEvent) => {
        dragStartY.current = e.clientY; dragLastY.current = e.clientY; vel.current = 0; dragDY.current = 0;
        lastTime.current = Date.now(); isCapturing.current = true;
        setNoTrans();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };
    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isCapturing.current) return;
        const now = Date.now(); const dt = now - lastTime.current;
        if (dt > 0) vel.current = (e.clientY - dragLastY.current) / dt * 1000;
        dragLastY.current = e.clientY; lastTime.current = now;
        const dy = e.clientY - dragStartY.current; dragDY.current = dy;
        if (!modalRef.current) return;
        if (modalState === 'expanded') {
            if (dy > 0) modalRef.current.style.height = Math.max(naturalH.current, expandedH() - dy) + 'px';
        }
        else {
            if (dy > 0) modalRef.current.style.transform = `translateY(${dy}px)`;
            else {
                modalRef.current.style.height = Math.min(expandedH(), naturalH.current + Math.abs(dy)) + 'px'; modalRef.current.style.transform = 'translateY(0)';
            }
        }
    };
    const handlePointerUp = () => {
        if (!isCapturing.current) return; isCapturing.current = false;
        const dy = dragDY.current; const v = vel.current;
        if (v > 1500 && dy > 0) { snapToClosed(); }
        else if (dy > 80 || v > 400) { if (modalState === 'expanded') snapToOpen(); else snapToClosed(); }
        else if (dy < -60 || v < -400) snapToExpanded();
        else { if (modalState === 'expanded') snapToExpanded(); else snapToOpen(); }
        dragDY.current = 0;
    };

    const selectFoodWithAmount = (food: FoodSearchResult, amt: number, u: 'g' | 'ml' | 'pcs', createdAt: number) => {
        setSelFood(food);
        setUnit(u);
        setAmount(amt);
        setEntryCreatedAt(createdAt);
        setShowNFT(false);
        goToStep(3);
    };

    const toggleSelFoodFav = () => {
        if (!selFood) return;
        if (isFav(selFood.name, selFood.brand ?? '')) {
            removeFav(selFood.name, selFood.brand ?? '');
            onShowToast('Removed from favourites');
        } else {
            saveFav(selFood);
            onShowToast('Added to favourites');
        }
        setFavs(loadFavs());
        forceUpdate(n => n + 1);
    };

    const goToStep = (n: number) => { setStep(n); };

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

    const logFood = () => {
        if (!selFood) return;
        const entry = buildFoodEntry(selFood, amount, unit || 'g');
        onLog(entry);
        loggedRef.current = true;
        snapToClosed();
        onShowToast(`${entry.kcal} kcal logged`);
    };

    useEffect(() => {
        snapToClosedRef.current = snapToClosed;
    }, [snapToClosed]);

    useEffect(() => {
        if (!openWithAi || modalState === 'closed') return;
        if (dispatchedForRef.current === openWithAi) return;
        let focusCleanup: (() => void) | null = null;
        const addFocusReveal = () => {
            const onFocus = () => {
                setTimeout(() => {
                    if (stepRef.current !== 1 && !aiProcessingRef.current) snapToClosedRef.current();
                }, 400);
            };
            window.addEventListener('focus', onFocus, { once: true });
            focusCleanup = () => window.removeEventListener('focus', onFocus);
        };
        const t = setTimeout(() => {
            if (dispatchedForRef.current === openWithAi) return;
            dispatchedForRef.current = openWithAi;
            if (openWithAi === 'describe') { setAiTextOpen(true); }
            else if (openWithAi === 'import') { aiImageInputRef.current?.click(); addFocusReveal(); }
            else if (openWithAi === 'capture') { aiCameraInputRef.current?.click(); addFocusReveal(); }
            revealModal();
        }, 100);
        return () => { clearTimeout(t); focusCleanup?.(); };
    }, [openWithAi, modalState, revealModal]);

    const titles: Record<number, string> = { 0: 'Upload', 1: 'Context', 2: 'Analyzing', 3: 'Finalize' };
    const isLastStep = step === 3;
    const canNext = step === 1 && (!!selectedFilePreview || !!selFood);
    const SVG_ARROW = <svg height="25" viewBox="0 -960 960 960" width="25" fill="#ffffff"><path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z" /></svg>;
    const SVG_CHECK = <svg height="25" viewBox="0 -960 960 960" width="25" fill="#ffffff"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" /></svg>;

    const QUICK_AMOUNTS = [50, 100, 150, 200, 250, 330, 400, 500];

    const processingLabel = (() => {
        if (pendingDetection?.status === 'awaiting-file') return 'Waiting for files';
        if (pendingDetection?.status === 'analyzing') return 'Analyzing...';
        if (openWithAi === 'import' || openWithAi === 'capture') return 'Waiting for files';
        if (aiTextOpen) return 'Waiting for content';
        return 'Analyzing...';
    })();

    return (
        <>
            <div className="app-overlay" id="appOverlay" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) snapToClosed(); }}>
                <div className="modal" id="modal" ref={modalRef}>
                    <div className="modal-handle-zone" id="handleZone" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
                        <div className="modal-handle" />
                    </div>
                    <div className="modal-header">
                        <div className="modal-title" id="modalTitle">{titles[step]}</div>
                    </div>

                    <div className="modal-body" id="modalBody" ref={bodyRef}>
                        <div style={{ display: 'flex', width: '400%', alignItems: 'flex-start', transform: `translateX(-${step * 25}%)`, transition: skipStepTransitionRef.current ? 'none' : 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                            <div className="modal-step" id="cs-step-processing" ref={processingRef} style={{ display: 'block', width: '25%', flexShrink: 0 }}>
                                <div className="search-step-inner">
                                    <input ref={aiImageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ''; }} />
                                    <input ref={aiCameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleCameraFile(f); e.target.value = ''; }} />
                                    <div className="ai-processing" id="aiProcessing" style={{ display: 'block' }}>
                                        <div className="processing-spinner">
                                            <i className="fa-solid fa-circle-notch fa-spin" />
                                        </div>
                                        <div className="processing-text" id="csProcessingText">{processingLabel}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-step" id="cs-step-context" ref={contextRef} style={{ display: 'block', width: '25%', flexShrink: 0 }}>
                                {(selectedFilePreview || (selFood && pendingDetection?.status !== 'completed')) && (
                                    <div className="context-step">
                                        <div className="context-image-preview">
                                            <img src={selectedFilePreview || URL.createObjectURL(new Blob())} alt={selFood?.name || 'Selected meal'} />
                                        </div>
                                        <div className="context-text-input-wrapper">
                                            <textarea
                                                placeholder="e.g. Honey, not cheese"
                                                rows={2}
                                                value={aiTextValue}
                                                onChange={e => setAiTextValue(e.target.value)}
                                                className="context-text-input"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal-step" id="cs-step-analyzing" ref={analyzingRef} style={{ display: 'block', width: '25%', flexShrink: 0 }}>
                                <div className="search-step-inner">
                                    <div className="ai-processing" id="aiProcessing" style={{ display: 'block' }}>
                                        <div className="processing-spinner">
                                            <i className="fa-solid fa-circle-notch fa-spin" />
                                        </div>
                                        <div className="processing-text" id="csProcessingText">{processingLabel}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-step" id="cs-step-finalize" ref={confirmRef} style={{ display: 'block', width: '25%', flexShrink: 0 }}>
                                {selFood && (!pendingDetection || pendingDetection.status === 'completed') && (
                                    <div className="food-confirm-inner">
                                        <div className="food-preview-card" id="foodPreviewCard">
                                            <div className="food-preview-emoji" id="foodPreviewEmoji">
                                                <i className={selFood.emoji || 'fa-solid fa-utensils'} style={{ color: selFood.color || 'var(--accent)' }} />
                                            </div>
                                            <div className="food-preview-info">
                                                <div className="food-preview-name" id="foodPreviewName">{selFood.name}</div>
                                                <div className="food-preview-brand" id="foodPreviewBrand">{selFood.brand}</div>
                                                <div className="food-preview-per" id="foodPreviewPer">{`per 100${selFood.defaultUnit}`}</div>
                                            </div>

                                            {!selFood.isManual && (
                                            <button
                                                type="button"
                                                className={`food-preview-fav${isFav(selFood.name, selFood.brand ?? '') ? ' active' : ''}`}
                                                onClick={toggleSelFoodFav}
                                                aria-label={isFav(selFood.name, selFood.brand ?? '') ? 'Remove from favourites' : 'Save to favourites'}
                                                title={isFav(selFood.name, selFood.brand ?? '') ? 'Remove from favourites' : 'Save to favourites'}
                                            >
                                                <i className={isFav(selFood.name, selFood.brand ?? '') ? 'fa-solid fa-star' : 'fa-regular fa-star'} />
                                            </button>
                                            )}
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
                                                    value={amount}
                                                    onChange={e => setAmount(Number(e.target.value))}
                                                />
                                                <div className="amount-unit-toggle">
                                                    {(['g', 'ml', 'pcs'] as const).map(u => (
                                                        <button
                                                            key={u}
                                                            type="button"
                                                            className={`unit-btn${unit === u ? ' active' : ''}`}
                                                            onClick={() => setUnit(u)}
                                                        >
                                                            {u}
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
                                                        {val}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="calorie-preview-row" id="caloriePreviewRow">
                                            <div className="calorie-big">
                                                <span id="calculatedCalories">{Math.round(calcKcal())}</span>
                                                <span className="calorie-unit-label">kcal</span>
                                            </div>
                                            <div className="macro-pills" id="macroPills">
                                                {(calcProt() > 0 || calcCarb() > 0 || calcFat() > 0) && (
                                                <>
                                                    <div className="macro-pill">P: {Math.round(calcProt())}g</div>
                                                    <div className="macro-pill">C: {Math.round(calcCarb())}g</div>
                                                    <div className="macro-pill">F: {Math.round(calcFat())}g</div>
                                                </>
                                                )}
                                            </div>
                                        </div>

                                        {!showNFT && <div id="manualNutrients" style={{ display: 'block' }} />}

                                        {showNFT && selFood.isBarcode && (
                                        <div className="nutrition-facts-table" id="nutritionFactsTable">
                                            <div className="nutrition-facts-header">
                                            <h3 className="nutrition-facts-title">Nutrition Facts</h3>
                                            <div className="nutrition-facts-subtitle">per 100<span id="nftUnit">{selFood.defaultUnit}</span></div>
                                            </div>
                                            <div className="nutrition-facts-body">
                                            <div className="nutrition-row nutrition-row-main"><span className="nutrition-label">Energy</span><span className="nutrition-value" id="nftEnergy">{selFood.energyKj} kJ / {selFood.kcalPer100} kcal</span></div>
                                            <div className="nutrition-row"><span className="nutrition-label">Fat</span><span className="nutrition-value"><span id="nftFat">{selFood.fatPer100}</span> g</span></div>
                                            <div className="nutrition-row nutrition-row-sub"><span className="nutrition-label">of which saturates</span><span className="nutrition-value" id="nftSatFat">{selFood.satFatPer100 !== null ? `${selFood.satFatPer100} g` : '-'}</span></div>
                                            <div className="nutrition-row"><span className="nutrition-label">Carbohydrate</span><span className="nutrition-value"><span id="nftCarbs">{selFood.carbPer100}</span> g</span></div>
                                            <div className="nutrition-row nutrition-row-sub"><span className="nutrition-label">of which sugars</span><span className="nutrition-value" id="nftSugar">{selFood.sugarPer100 !== null ? `${selFood.sugarPer100} g` : '-'}</span></div>
                                            <div className="nutrition-row"><span className="nutrition-label">Protein</span><span className="nutrition-value"><span id="nftProtein">{selFood.protPer100}</span> g</span></div>
                                            <div className="nutrition-row"><span className="nutrition-label">Salt</span><span className="nutrition-value" id="nftSalt">{selFood.saltPer100 !== null ? `${selFood.saltPer100} g` : '-'}</span></div>
                                            </div>
                                        </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer" id="modalFooter">
                        <button className="confirm-btn" id="actionBtn" disabled={!canNext && !(isLastStep && selFood)} onClick={() => { if (canNext) handleNextClick(); else if (isLastStep && selFood) logFood(); }}>
                            <span className="btn-icon" id="actionIcon">{isLastStep ? SVG_CHECK : SVG_ARROW}</span>
                        </button>
                    </div>
                </div>

            </div>
            <div className={`app-overlay${aiTextOpen ? ' visible' : ''}`} id="aiTextOverlay"
                onClick={e => { if (e.currentTarget === e.target) setAiTextOpen(false); }}>
                <div className="modal" id="aiTextModal"
                style={{ transform: aiTextOpen ? 'translateY(0)' : 'translateY(110%)', transition: 'transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)' }}>
                    <div className="modal-handle-zone" id="aiTextHandleZone">
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