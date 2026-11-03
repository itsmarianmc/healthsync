'use client';

import { useState, useEffect } from 'react';
import type { DrinkEntry } from '../../_lib/types';
import DrinkPicker, { type DrinkOption } from './DrinkPicker';
import GlassInput from './GlassInput';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { useSheetSteps } from '../../_hooks/useSheetSteps';

interface DropSyncModalProps {
    onClose: () => void;
    onAddEntry: (entry: DrinkEntry) => void;
    isOpen: boolean;
}

export default function DropSyncModal({ onClose, onAddEntry, isOpen }: DropSyncModalProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const { setTrackRef, painted, changing, onTransitionEnd } = useSheetSteps(step - 1);
    const [selectedDrink, setSelectedDrink] = useState<DrinkOption | null>(null);
    const [amount, setAmount] = useState(250);
    const sheet = useDraggableSheet({ onClose: () => {
        setStep(1); setSelectedDrink(null); setAmount(250); onClose();
    } });
    const { modalRef, overlayRef, close: snapToClosed, handleProps, open } = sheet;
    useEffect(() => { if (isOpen) open(); else snapToClosed(); }, [isOpen, open, snapToClosed]);
    const handleSelectDrink = (drink: DrinkOption) => {
        setSelectedDrink(drink);
        setStep(2);
    };

    const handleAddEntry = () => {
        if (!selectedDrink) return;
        const entry: DrinkEntry = {
        id: Date.now().toString(),
        drink: selectedDrink.name,
        emoji: selectedDrink.emoji,
        color: selectedDrink.color,
        amount,
        ts: Date.now(),
        date: new Date().toDateString(),
        source: 'dropsync',
        };
        onAddEntry(entry);
        snapToClosed();
    };

    const handleBack = () => {
        setStep(1);
    };

    const SVG_ARROW = <svg height="25" viewBox="0 -960 960 960" width="25" fill="#ffffff"><path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z"/></svg>;
    const SVG_CHECK = <svg height="25" viewBox="0 -960 960 960" width="25" fill="#ffffff"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>;

    return (
        <div
            className="app-overlay appoverlay"
            id="ds-addOverlay"
            ref={overlayRef}
            onClick={e => { if (e.target === overlayRef.current) snapToClosed(); }}
            >
            <div className="modal" id="ds-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="ds-modalTitle">
                <div
                className="modal-handle-zone"
                id="ds-handleZone"
                {...handleProps}
                >
                    <div className="modal-handle" />
                </div>
                <div className="modal-header">
                    <div className="modal-btn">
                        <button
                            className={`back-btn${step === 1 ? ' hidden' : ''}`}
                            id="ds-backBtn"
                            aria-label="Back to drinks"
                            style={{ opacity: step === 2 ? 1 : 0 }}
                            onClick={handleBack}
                            >
                            <svg height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z"/></svg>
                        </button>
                    </div>
                    <div className="modal-title" id="ds-modalTitle">
                        {step === 1 ? 'What did you drink?' : selectedDrink?.name || 'Amount'}
                    </div>
                </div>
                <div className="modal-body" id="ds-modalBody" style={{ overflowX: 'hidden', overflowY: 'auto' }}>
                    <div className="sheet-step-track" ref={setTrackRef} data-content-changing={changing} onTransitionEnd={onTransitionEnd} style={{ display: 'flex', gap: '24px', width: '200%', alignItems: 'flex-start', transform: `translateX(${step === 1 ? '0' : 'calc(-50% - 24px)'})` }}>
                        <div inert={step !== 1} aria-hidden={step !== 1} style={{ display: 'block', width: '50%', flexShrink: 0, height: painted(0) ? 'auto' : 0, overflow: 'hidden' }}>
                            <DrinkPicker selected={selectedDrink} onSelect={handleSelectDrink} />
                        </div>
                        <div inert={step !== 2} aria-hidden={step !== 2} style={{ display: 'block', width: '50%', flexShrink: 0, height: painted(1) ? 'auto' : 0, overflow: 'hidden' }}>
                            {selectedDrink && <GlassInput amount={amount} onChange={setAmount} drinkColor={selectedDrink.color} />}
                        </div>
                    </div>
                </div>
                <div className="modal-footer" id="ds-modalFooter">
                    <button
                        id="ds-actionBtn"
                        aria-label={step === 1 ? "Continue" : "Log drink"}
                        className="confirm-btn"
                        disabled={step === 1 && !selectedDrink}
                        onClick={step === 1 ? () => selectedDrink && handleSelectDrink(selectedDrink) : handleAddEntry}
                        >
                        <span id="ds-actionIcon">{step === 1 ? SVG_ARROW : SVG_CHECK}</span>
                </button>
                </div>
            </div>
        </div>
    );
}
