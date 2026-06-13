'use client';

import { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import type { DrinkEntry } from '../../_lib/types';
import DrinkLog from './DrinkLog';
import DropSyncModal from './DropSyncModal';
import HistoryModal from './HistoryModal';
import { useAuth } from '../../_context/AuthContext';
import { syncDrinkToCloud, deleteDrinkFromCloud } from '../../_lib/sync';
import { removeHeaderBtn, addHeaderBtn } from '../../_lib/headerBtns';

const RING_CIRC = 2 * Math.PI * 95;

function fmtAgo(ts: number) {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m} min ago`;
    return `${Math.floor(m / 60)} hr ago`;
}

function fmtMl(val: number) {
    if (val >= 1000) return (val / 1000).toFixed(1).replace('.', ',') + ' L';
    return Math.round(val) + '';
    }

interface DropSyncProps {
    nfl?: boolean;
    onOpenSettings: () => void;
    openModal?: boolean;
    onModalClose?: () => void;
}

export default function DropSync({
        nfl,
        onOpenSettings,
        openModal: externalOpenModal,
        onModalClose: externalOnModalClose,
    }: DropSyncProps) {
    const { user, showToast } = useAuth();
    const [entries, setEntries] = useState<DrinkEntry[]>([]);
    const [goal, setGoal] = useState(2500);
    const [modalOpen, setModalOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);

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
        if (historyOpen) removeHeaderBtn('ds-openHistoryBtn');
        else addHeaderBtn('ds-openHistoryBtn');
    }, [historyOpen]);

    const loadEntries = useCallback(() => {
        try {
            const raw = localStorage.getItem('dropsync_v3') || '[]';
            setEntries(JSON.parse(raw));
        } catch { setEntries([]); }
        setGoal(parseInt(localStorage.getItem('dropsync_goal') || '2500', 10));
    }, []);

    useEffect(() => {
        loadEntries();
        window.addEventListener('storage', loadEntries);
        window.addEventListener('viewChanged', loadEntries);
        const interval = setInterval(loadEntries, 30000);
        return () => {
            window.removeEventListener('storage', loadEntries);
            window.removeEventListener('viewChanged', loadEntries);
            clearInterval(interval);
        };
    }, [loadEntries]);

    const today = new Date().toDateString();
    const todayEntries = entries.filter(e => e.date === today);
    const total = todayEntries.reduce((s, e) => s + e.amount, 0);
    const pct = Math.min(total / goal, 1);
    const offset = RING_CIRC * (1 - pct);
    const isLiter = total >= 1000;

    const handleAddEntry = useCallback(async (entry: DrinkEntry) => {
        const updated = [...entries, entry];
        setEntries(updated);
        localStorage.setItem('dropsync_v3', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
        if (total + entry.amount >= goal) showToast('Daily goal reached!', 3000, null, 'toast-success');
        else showToast(`+${entry.amount} ml`);
        if (user) await syncDrinkToCloud(entry, user.id);
    }, [entries, goal, total, user, showToast]);

    const handleDeleteEntry = useCallback(async (id: string) => {
        const updated = entries.filter(e => e.id !== id);
        setEntries(updated);
        localStorage.setItem('dropsync_v3', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
        if (user) await deleteDrinkFromCloud(id, user.id);
        showToast('Entry deleted');
    }, [entries, user, showToast]);

    const handleClearAll = useCallback(() => {
        const warnEnabled = localStorage.getItem('dropsync_delete_warning') !== 'false';
        if (warnEnabled && !confirm('Delete all entries for today?')) return;
        const kept = entries.filter(e => e.date !== today);
        setEntries(kept);
        localStorage.setItem('dropsync_v3', JSON.stringify(kept));
        window.dispatchEvent(new Event('storage'));
        showToast('All entries deleted');
    }, [entries, today, showToast]);

    const handleModalClose = useCallback(() => {
        setModalOpen(false);
        externalOnModalClose?.();
    }, [externalOnModalClose]);

    const fmtGoal = goal >= 1000 ? (goal/1000).toFixed(1).replace('.',',') + 'L' : goal + 'ml';
    const latestEntry = todayEntries[todayEntries.length - 1];

    const settingsIcon = (
        <svg viewBox="0 -960 960 960" fill="currentColor">
            <path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 14-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z"/>
        </svg>
    );
    const addIcon = <svg viewBox="0 -960 960 960" fill="currentColor"><path d="M440-120v-320H120v-80h320v-320h80v320h320v80H520v320h-80Z" /></svg>;
    const historyIcon = <svg viewBox="0 -960 960 960" fill="currentColor"><path d="m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z" /></svg>;

    return (
        <div id="dropsync-view" className={`app-view active${nfl ? ' nfl' : ''}`}>
            <div className="header">
                <div className="header-title-row">
                    <div className="header-title">Drop<span>Sync</span></div>
                    <div className="button-box">
                        <button id="ds-openModalBtn" data-order="1" title="Add New Drink" onClick={() => setModalOpen(true)}>{addIcon}</button>
                        <button id="ds-openHistoryBtn" data-order="2" title="History" onClick={() => setHistoryOpen(true)}>{historyIcon}</button>
                        <button className="settings-button" id="ds-openSettingsBtn" data-order="3" title="Settings" onClick={onOpenSettings}>{settingsIcon}</button>
                    </div>
                </div>
                <div className="header-greeting"><span id="ds-dateLabel">{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
            </div>

            <div className="ring-section">
                <div className="ring-container" id="ringContainer">
                    <svg className="ring-svg" viewBox="0 0 220 220">
                        <defs>
                            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#b3cbf9" />
                                <stop offset="100%" stopColor="#5948cf" />
                            </linearGradient>
                        </defs>
                        <circle className="ring-track" cx="110" cy="110" r="95" />
                        <circle className="ring-progress" id="ringProgress" cx="110" cy="110" r="95"
                        style={{ strokeDasharray: RING_CIRC, strokeDashoffset: offset }} />
                    </svg>
                    <div className="ring-inner">
                        <div className="ring-amount" id="ringAmount" style={{ fontSize: isLiter ? '30px' : '38px' }}>
                            {isLiter ? fmtMl(total) : total}
                        </div>
                        <div className="ring-unit">ml today</div>
                        <div className="ring-goal">Goal: {fmtGoal}</div>
                    </div>
                </div>
            </div>

            <div className="stats-row" id="ds-statsRow">
                <div className="stat-card">
                    <div className="stat-icon"><i className="fa-solid fa-fire-flame-curved" /></div>
                    <div className="stat-value" id="ds-statPct">{Math.round(pct * 100)}%</div>
                    <div className="stat-label">Progress</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><i className="fa-solid fa-bottle-water" /></div>
                    <div className="stat-value" id="ds-statCount">{todayEntries.length}</div>
                    <div className="stat-label">Drinks</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><i className="fa-solid fa-stopwatch" /></div>
                    <div className="stat-value" id="ds-statLast">{latestEntry ? fmtAgo(latestEntry.ts) : '-'}</div>
                    <div className="stat-label">Last</div>
                </div>
            </div>

            <DrinkLog entries={entries} onDelete={handleDeleteEntry} onClearAll={handleClearAll} />
            <HistoryModal entries={entries} isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />

            <DropSyncModal
                isOpen={modalOpen}
                onClose={handleModalClose}
                onAddEntry={handleAddEntry}
            />
        </div>
    );
}
