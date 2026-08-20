'use client';

import { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { FoodEntry, DrinkEntry, PendingFoodDraft, DraftChange, FoodSearchResult } from '../../_lib/types';
import type { GeminiAnalysis } from '../../_lib/gemini';
import FoodList from './FoodList';
import MacroRings from './MacroRings';
import CalSyncModal from './CalSyncModal';
import AiMethodModal from './AiMethodModal';
import CalHistoryModal from './CalHistoryModal';
import { useAuth } from '../../_context/AuthContext';
import { useAppShell } from '../../_context/AppShellContext';
import { useAiDetection } from '../../_context/AiDetectionContext';
import { usePendingFoodDraft } from '../../_hooks/usePendingFoodDraft';
import { pushFoodEntriesToCloud, deleteFoodFromCloud, syncDrinkToCloud } from '../../_lib/sync';
import { removeHeaderBtn, addHeaderBtn } from '../../_lib/headerBtns';
import { generateDraftId } from '../../_lib/ids';
import HeaderTitle from '../shared/HeaderTitle';
import { logger } from '@/lib/logger';

const PENDING_KEY = 'calsync_pending';
const PENDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function resultToFoodSearchResult(result: GeminiAnalysis): FoodSearchResult {
    return {
        name: result.name,
        brand: result.brand || 'AI Detection',
        kcalPer100: result.amount > 0 ? Math.round(result.calories / result.amount * 100 * 10) / 10 : 0,
        protPer100: result.amount > 0 ? Math.round(result.protein / result.amount * 100 * 10) / 10 : 0,
        carbPer100: result.amount > 0 ? Math.round(result.carbs   / result.amount * 100 * 10) / 10 : 0,
        fatPer100:  result.amount > 0 ? Math.round(result.fat     / result.amount * 100 * 10) / 10 : 0,
        emoji: 'fa-solid fa-utensils',
        color: 'var(--accent)',
        defaultUnit: (result.unit as 'g' | 'ml') || 'g',
        servingSize: result.amount,
        isManual: false,
        isBarcode: false,
    };
}

interface CalSyncProps {
    nfl?: boolean;
    onOpenSettings: () => void;
    openModal?: boolean;
    openWithAi?: 'describe'|'import'|'capture'|null;
    onModalClose?: () => void;
    openAiMethod?: boolean;
    onAiMethodClose?: () => void;
}

export default function CalSync({
        nfl,
        onOpenSettings,
        openModal: externalOpenModal,
        openWithAi,
        onModalClose: externalOnModalClose,
        openAiMethod: externalOpenAiMethod,
        onAiMethodClose: externalOnAiMethodClose,
}: CalSyncProps) {
    const pathname = usePathname();
    const { barcodeSearchOpen } = useAppShell();
    const { user, showToast } = useAuth();
    const {
        isAiDetectionUsable,
        detections,
        pendingAutoOpenId,
        runDetection,
        beginAnalysis,
        getDetection,
        consumePendingAutoOpen,
        dismissDetection,
    } = useAiDetection();
    const { saveActiveDraft, loadActiveDraft, clearActiveDraft } = usePendingFoodDraft();
    const [entries, setEntries] = useState<FoodEntry[]>([]);
    const [goal, setGoal] = useState(2000);
    const [modalOpen, setModalOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [tick, setTick] = useState(0);
    const [addingId, setAddingId] = useState<string | null>(null);
    const [aiMethodOpen, setAiMethodOpen] = useState(false);
    const [localOpenWithAi, setLocalOpenWithAi] = useState<'describe' | 'import' | 'capture' | null>(null);
    const [pendingDrafts, setPendingDrafts] = useState<PendingFoodDraft[]>([]);
    const [prefill, setPrefill] = useState<{ food: FoodSearchResult; amount: number; unit: 'g' | 'ml' | 'pcs'; createdAt: number } | null>(null);
    const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
    const [currentDetectionId, setCurrentDetectionId] = useState<string | null>(null);

    useLayoutEffect(() => {
        return () => {
            setModalOpen(false);
            setHistoryOpen(false);
        };
    }, []);

    useEffect(() => {
        if (externalOpenModal) setModalOpen(true);
    }, [externalOpenModal]);

    useEffect(() => {
        if (externalOpenModal || modalOpen || pendingAutoOpenId) return;
        const draft = loadActiveDraft();
        if (!draft) return;
        setPrefill({ food: draft.food, amount: draft.amount, unit: draft.unit, createdAt: draft.ts });
        setModalOpen(true);
        showToast('Restored pending AI detection');
    }, [externalOpenModal, modalOpen, pendingAutoOpenId, loadActiveDraft, showToast]);

    useEffect(() => {
        if (externalOpenAiMethod) {
            setAiMethodOpen(true);
            externalOnAiMethodClose?.();
        }
    }, [externalOpenAiMethod, externalOnAiMethodClose]);

    useEffect(() => {
        if (historyOpen) removeHeaderBtn('cs-openHistoryBtn');
        else addHeaderBtn('cs-openHistoryBtn');
    }, [historyOpen]);

    useEffect(() => {
        if (aiMethodOpen) removeHeaderBtn('cs-openAiBtn');
        else addHeaderBtn('cs-openAiBtn');
    }, [aiMethodOpen]);

    const loadEntries = useCallback(() => {
        try {
            const raw = JSON.parse(localStorage.getItem('calsync_v1') || '[]') as FoodEntry[];
            const migrated = raw.map(e => e.status === 'pending' ? { ...e, status: 'confirmed' as const } : e);
            setEntries(migrated);
        } catch { setEntries([]); }
        setGoal(parseInt(localStorage.getItem('calsync_goal') || '2000', 10));
    }, []);

    const savePendingDrafts = useCallback((drafts: PendingFoodDraft[]) => {
        try {
            localStorage.setItem(PENDING_KEY, JSON.stringify(drafts));
            window.dispatchEvent(new Event('storage'));
        } catch (err) {
            logger.error('Failed to persist pending drafts');
        }
    }, []);

    const loadPendingDrafts = useCallback(() => {
        try {
            const raw = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]') as PendingFoodDraft[];
            const cutoff = Date.now() - PENDING_TTL_MS;
            const fresh = raw.filter(d => d && d.id && d.food && typeof d.ts === 'number' && d.ts > cutoff);
            const expiredCount = raw.length - fresh.length;
            setPendingDrafts(fresh);
            if (fresh.length !== raw.length) {
                savePendingDrafts(fresh);
                if (expiredCount > 0) showToast(`${expiredCount} old AI draft${expiredCount === 1 ? '' : 's'} cleaned up`);
            }
        } catch {
            setPendingDrafts([]);
        }
    }, [savePendingDrafts, showToast]);

    useEffect(() => {
        loadEntries();
        loadPendingDrafts();
        window.addEventListener('storage', loadEntries);
        window.addEventListener('storage', loadPendingDrafts);
        window.addEventListener('viewChanged', loadEntries);
        window.addEventListener('focus', loadEntries);
        const interval = setInterval(() => { loadEntries(); setTick(t => t + 1); }, 30000);
        const onSymLog = (e: Event) => {
            try {
                const detail = (e as CustomEvent).detail as FoodEntry | undefined;
                if (detail) handleLog(detail);
            } catch (err) {
                logger.error('Failed to handle sync event');
            }
        };
        window.addEventListener('sym:logFood', onSymLog as EventListener);
        return () => {
            window.removeEventListener('storage', loadEntries);
            window.removeEventListener('storage', loadPendingDrafts);
            window.removeEventListener('viewChanged', loadEntries);
            window.removeEventListener('focus', loadEntries);
            window.removeEventListener('sym:logFood', onSymLog as EventListener);
            clearInterval(interval);
        };
    }, [loadEntries, loadPendingDrafts]);

    const save = useCallback((updated: FoodEntry[]) => {
        localStorage.setItem('calsync_v1', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
    }, []);


    const handleLog = useCallback(async (entry: FoodEntry) => {
        setAddingId(entry.id);
        try {
            const updated = [...entries, entry];
            setEntries(updated);
            save(updated);
            if (user) await pushFoodEntriesToCloud([entry], user.id);
            if (entry.isDrink) {
                const drinkEntry: DrinkEntry = {
                    id: entry.id,
                    drink: entry.food,
                    emoji: entry.emoji,
                    color: entry.color,
                    amount: entry.amount || 250,
                    ts: entry.ts,
                    date: entry.date,
                    source: 'calsync',
                };
                const dsEntries = JSON.parse(localStorage.getItem('dropsync_v3') || '[]');
                dsEntries.push(drinkEntry);
                localStorage.setItem('dropsync_v3', JSON.stringify(dsEntries));
                if (user) await syncDrinkToCloud(drinkEntry, user.id);
            }
        } finally {
            setAddingId(null);
        }
    }, [entries, save, user]);

    const handleDelete = useCallback(async (id: string) => {
        const toDelete = entries.find(e => e.id === id);
        if (!toDelete) return;
        const updated = entries.filter(e => e.id !== id);
        setEntries(updated);
        save(updated);
        if (user) await deleteFoodFromCloud(id, user.id);
        showToast(`Deleted ${toDelete.food}`, 4000, async () => {
            const restored = [...updated, toDelete].sort((a, b) => a.ts - b.ts);
            setEntries(restored);
            save(restored);
            if (user) await pushFoodEntriesToCloud([toDelete], user.id);
            showToast('Entry restored');
        });
    }, [entries, save, user, showToast]);

    const handleClearAll = useCallback(async () => {
        const today = new Date().toDateString();
        if (localStorage.getItem('dropsync_delete_warning') !== 'false' && !confirm("Delete all of today's entries?")) return;
        const deleted = entries.filter(e => e.date === today);
        const kept = entries.filter(e => e.date !== today);
        setEntries(kept);
        save(kept);
        for (const e of deleted) {
            if (user) await deleteFoodFromCloud(e.id, user.id);
        }
        showToast("Today's entries deleted", 4000, async () => {
            const restored = [...kept, ...deleted].sort((a, b) => a.ts - b.ts);
            setEntries(restored);
            save(restored);
            if (user) await pushFoodEntriesToCloud(deleted, user.id);
            showToast('Entries restored');
        });
    }, [entries, save, user, showToast]);

    const handleModalClose = useCallback(() => {
        setModalOpen(false);
        setLocalOpenWithAi(null);
        setPrefill(null);
        setEditingDraftId(null);
        clearActiveDraft();
        externalOnModalClose?.();
    }, [externalOnModalClose, clearActiveDraft]);

    const handleDismissCurrentDetection = useCallback(() => {
        setCurrentDetectionId(null);
    }, []);

    const handleAiMethodSelect = useCallback((mode: 'describe' | 'import' | 'capture') => {
        setAiMethodOpen(false);
        setLocalOpenWithAi(mode);
        setPrefill(null);
        setEditingDraftId(null);
        setModalOpen(true);
    }, []);

    const handleDraftChange = useCallback((change: DraftChange) => {
        let next: PendingFoodDraft[];
        let isNewCreate = false;
        switch (change.type) {
            case 'create':
                if (pendingDrafts.some(d => d.id === change.draft.id)) {
                    next = pendingDrafts;
                } else {
                    next = [change.draft, ...pendingDrafts];
                    isNewCreate = true;
                }
                break;
            case 'delete':
                next = pendingDrafts.filter(d => d.id !== change.draftId);
                break;
            case 'update':
                next = pendingDrafts.map(d => d.id === change.draftId
                    ? { ...d, amount: change.amount, unit: change.unit }
                    : d);
                break;
        }
        if (isNewCreate) showToast('Saved as pending draft');
        setPendingDrafts(next);
        savePendingDrafts(next);
    }, [pendingDrafts, savePendingDrafts, showToast]);

    const handleOpenDraft = useCallback((id: string) => {
        const draft = pendingDrafts.find(d => d.id === id);
        if (!draft) return;
        setPrefill({ food: draft.food, amount: draft.amount, unit: draft.unit, createdAt: draft.ts });
        setEditingDraftId(id);
        setLocalOpenWithAi(null);
        setModalOpen(true);
    }, [pendingDrafts]);

    const handleDiscardDraft = useCallback((id: string) => {
        setPendingDrafts(prev => {
            const next = prev.filter(d => d.id !== id);
            savePendingDrafts(next);
            return next;
        });
        showToast('Pending draft removed');
    }, [savePendingDrafts, showToast]);

    const handleStartDetection = useCallback((input: { mode: 'describe' | 'import' | 'capture'; text?: string; file?: File }) => {
        const id = runDetection(input);
        setCurrentDetectionId(id);
        if (input.mode !== 'describe') {
            beginAnalysis(id);
        }
    }, [runDetection, beginAnalysis]);

    const handleDetectionResolved = useCallback((id: string, action: 'log' | 'dismiss') => {
        const detection = getDetection(id);
        if (action === 'dismiss') {
            if (detection?.result) {
                const food = resultToFoodSearchResult(detection.result);
                const draft: PendingFoodDraft = {
                    id: generateDraftId(),
                    food,
                    amount: detection.result.amount,
                    unit: (detection.result.unit as 'g' | 'ml' | 'pcs') || 'g',
                    ts: detection.startedAt,
                };
                handleDraftChange({ type: 'create', draft });
                dismissDetection(id);
            } else {}
        } else {
            dismissDetection(id);
        }
        if (currentDetectionId === id) setCurrentDetectionId(null);
    }, [getDetection, dismissDetection, handleDraftChange, showToast, currentDetectionId]);

    useEffect(() => {
        if (!pendingAutoOpenId) return;
        if (pathname !== '/food') {
            consumePendingAutoOpen();
            return;
        }
        if (modalOpen) {
            consumePendingAutoOpen();
            return;
        }
        if (barcodeSearchOpen) {
            consumePendingAutoOpen();
            return;
        }
        const detection = getDetection(pendingAutoOpenId);
        if (!detection) {
            consumePendingAutoOpen();
            return;
        }
        setLocalOpenWithAi(null);
        setPrefill(null);
        setEditingDraftId(null);
        setCurrentDetectionId(pendingAutoOpenId);
        setModalOpen(true);
        consumePendingAutoOpen();
    }, [pendingAutoOpenId, pathname, modalOpen, barcodeSearchOpen, getDetection, consumePendingAutoOpen]);

    const pendingDetection = currentDetectionId
        ? detections.find(d => d.id === currentDetectionId) ?? null
        : null;

    useEffect(() => {
        if (!modalOpen) return;
        if (!pendingDetection || pendingDetection.status !== 'completed' || !pendingDetection.result) return;
        saveActiveDraft({
            id: pendingDetection.id,
            food: resultToFoodSearchResult(pendingDetection.result),
            amount: pendingDetection.result.amount || 100,
            unit: (pendingDetection.result.unit as 'g' | 'ml' | 'pcs') || 'g',
            ts: pendingDetection.startedAt,
        });
    }, [modalOpen, pendingDetection, saveActiveDraft]);

    const settingsIcon = (
        <svg viewBox="0 -960 960 960" fill="currentColor">
            <path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 14-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z" />
        </svg>
    );
    const historyIcon = <svg viewBox="0 -960 960 960" fill="currentColor"><path d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83-0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z" /></svg>;
    const addIcon = <svg viewBox="0 -960 960 960" fill="currentColor"><path d="M440-120v-320H120v-80h320v-320h80v320h320v80H520v320h-80Z" /></svg>;

    return (
        <div id="calsync-view" className={`app-view active${nfl ? ' nfl' : ''}`}>
            <div className="header">
                <div className="header-title-row">
                    <HeaderTitle />
                    <div className="button-box">
                        <button id="cs-openAiBtn" data-order="1" title="AI Detection" onClick={() => setAiMethodOpen(true)}>{addIcon}</button>
                        <button id="cs-openHistoryBtn" data-order="2" title="History" onClick={() => setHistoryOpen(true)}>{historyIcon}</button>
                        <button className="settings-button" id="cs-openSettingsBtn" data-order="3" title="Settings" onClick={onOpenSettings}>{settingsIcon}</button>
                    </div>
                </div>
                <div className="header-greeting"><span id="cs-dateLabel">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
            </div>
            <MacroRings key={tick} entries={entries} goal={goal} />
            <FoodList
                entries={entries}
                onDelete={handleDelete}
                onClearAll={handleClearAll}
                addingId={addingId}
                pendingDrafts={pendingDrafts}
                onOpenDraft={handleOpenDraft}
                onDiscardDraft={handleDiscardDraft}
            />
            <CalHistoryModal entries={entries} isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
            <AiMethodModal isOpen={aiMethodOpen} onClose={() => setAiMethodOpen(false)} onSelect={handleAiMethodSelect} isAiDetectionUsable={isAiDetectionUsable} onOpenSettings={onOpenSettings} />
            <CalSyncModal
                isOpen={modalOpen}
                onClose={handleModalClose}
                onLog={handleLog}
                onShowToast={(msg, dur, undo, cls) => showToast(msg, dur ?? 2000, undo ?? undefined, cls)}
                openWithAi={localOpenWithAi ?? openWithAi ?? null}
                onOpenSettings={onOpenSettings}
                prefill={prefill}
                editingDraftId={editingDraftId}
                onDraftChange={handleDraftChange}
                pendingDetection={pendingDetection}
                onDetectionResolved={handleDetectionResolved}
                onStartDetection={handleStartDetection}
            />
        </div>
    );
}