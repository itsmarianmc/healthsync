'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppShell } from '../../_context/AppShellContext';
import { useAiDetection } from '../../_context/AiDetectionContext';
import { useAuth } from '../../_context/AuthContext';
import { usePendingFoodDraft } from '../../_hooks/usePendingFoodDraft';
import { logFoodEntry } from '../../_lib/foodLog';
import { toGeminiFoodSearchResult } from '../../_lib/gemini';
import { generateDraftId } from '../../_lib/ids';
import type { DraftChange, FoodEntry, PendingFoodDraft } from '../../_lib/types';
import AiMethodModal, { type AiMethod } from './AiMethodModal';
import CalSyncModal from './CalSyncModal';

const PENDING_KEY = 'calsync_pending';

export default function GlobalFoodActions() {
    const { foodAction, openFoodAction, closeFoodAction, openSettings, barcodeSearchOpen } = useAppShell();
    const { user, showToast } = useAuth();
    const {
        isAiDetectionUsable, detections, pendingAutoOpenId, runDetection, beginAnalysis,
        getDetection, consumePendingAutoOpen, dismissDetection,
    } = useAiDetection();
    const { saveActiveDraft, clearActiveDraft } = usePendingFoodDraft();
    const [currentDetectionId, setCurrentDetectionId] = useState<string | null>(null);
    const methodSelectionRef = useRef(false);
    const modalOpen = (foodAction !== null && foodAction !== 'methods') || currentDetectionId !== null;

    useEffect(() => {
        if (!pendingAutoOpenId || barcodeSearchOpen) return;
        if (modalOpen) {
            consumePendingAutoOpen();
            return;
        }
        if (!getDetection(pendingAutoOpenId)) {
            consumePendingAutoOpen();
            return;
        }
        closeFoodAction();
        queueMicrotask(() => setCurrentDetectionId(pendingAutoOpenId));
        consumePendingAutoOpen();
    }, [pendingAutoOpenId, modalOpen, barcodeSearchOpen, getDetection, consumePendingAutoOpen, closeFoodAction]);

    const pendingDetection = currentDetectionId
        ? detections.find(detection => detection.id === currentDetectionId) ?? null
        : null;

    useEffect(() => {
        if (!modalOpen || pendingDetection?.status !== 'completed' || !pendingDetection.result) return;
        saveActiveDraft({
            id: pendingDetection.id,
            food: toGeminiFoodSearchResult(pendingDetection.result, {
                name: 'Unknown', emoji: 'fa-solid fa-utensils', color: 'var(--accent)',
            }),
            amount: pendingDetection.result.amount || 100,
            unit: (pendingDetection.result.unit as 'g' | 'ml' | 'pcs') || 'g',
            ts: pendingDetection.startedAt,
        });
    }, [modalOpen, pendingDetection, saveActiveDraft]);

    const handleLog = useCallback(async (entry: FoodEntry) => {
        return logFoodEntry(entry, user?.id);
    }, [user?.id]);

    const handleDraftChange = useCallback((change: DraftChange) => {
        const previous = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]') as PendingFoodDraft[];
        let next: PendingFoodDraft[];
        if (change.type === 'create') {
            next = previous.some(draft => draft.id === change.draft.id)
                ? previous : [change.draft, ...previous];
            if (next !== previous) showToast('Saved as pending draft');
        } else if (change.type === 'delete') {
            next = previous.filter(draft => draft.id !== change.draftId);
        } else {
            next = previous.map(draft => draft.id === change.draftId
                ? { ...draft, amount: change.amount, unit: change.unit } : draft);
        }
        localStorage.setItem(PENDING_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event('storage'));
    }, [showToast]);

    const handleDetectionResolved = useCallback((id: string, action: 'log' | 'dismiss') => {
        const detection = getDetection(id);
        if (action === 'dismiss' && detection?.result) {
            handleDraftChange({
                type: 'create',
                draft: {
                    id: generateDraftId(),
                    food: toGeminiFoodSearchResult(detection.result, {
                        name: 'Unknown', emoji: 'fa-solid fa-utensils', color: 'var(--accent)',
                    }),
                    amount: detection.result.amount,
                    unit: (detection.result.unit as 'g' | 'ml' | 'pcs') || 'g',
                    ts: detection.startedAt,
                },
            });
        }
        if (action === 'log' || detection?.result) dismissDetection(id);
        setCurrentDetectionId(current => current === id ? null : current);
    }, [getDetection, handleDraftChange, dismissDetection]);

    const handleStartDetection = useCallback((input: { mode: AiMethod; text?: string; file?: File }) => {
        const id = runDetection(input);
        setCurrentDetectionId(id);
        if (input.mode !== 'describe') beginAnalysis(id);
    }, [runDetection, beginAnalysis]);

    const handleClose = useCallback(() => {
        setCurrentDetectionId(null);
        clearActiveDraft();
        closeFoodAction();
    }, [clearActiveDraft, closeFoodAction]);

    const handleMethodClose = useCallback(() => {
        if (methodSelectionRef.current) {
            methodSelectionRef.current = false;
            return;
        }
        closeFoodAction();
    }, [closeFoodAction]);

    const handleMethodSelect = useCallback((mode: AiMethod) => {
        methodSelectionRef.current = true;
        openFoodAction(mode);
    }, [openFoodAction]);

    return <>
        <AiMethodModal
            isOpen={foodAction === 'methods'}
            onClose={handleMethodClose}
            onSelect={handleMethodSelect}
            isAiDetectionUsable={isAiDetectionUsable}
            onOpenSettings={openSettings}
        />
        <CalSyncModal
            isOpen={modalOpen}
            onClose={handleClose}
            onLog={handleLog}
            onShowToast={(message, duration, undo, className) => showToast(message, duration ?? 2000, undo ?? undefined, className)}
            openWithAi={foodAction === 'methods' ? null : foodAction}
            onOpenSettings={openSettings}
            pendingDetection={pendingDetection}
            onDetectionResolved={handleDetectionResolved}
            onStartDetection={handleStartDetection}
        />
    </>;
}
