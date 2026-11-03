'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import BarcodeScanner from './BarcodeScanner';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { useCookieConsent } from '../../_lib/useCookieConsent';
import { useAuth } from '../../_context/AuthContext';
import { friendlyCameraLabel } from '../../_lib/camera';
import { buildFoodAmountEntry, foodNutrition } from '../../_lib/foodEntry';
import type { FoodEntry, FoodSearchResult } from '../../_lib/types';
import { mapBarcodeProduct } from '../../_lib/barcodeFood';
import { foodAmountToBase, foodAmountUnits, foodUnitOptionLabel, foodBasisLabel, foodConversionIssue, formatFoodNumber, type FoodAmountUnit } from '../../_lib/foodPortions';
import FoodReviewEditorSheet from './FoodReviewEditorSheet';
import { useSheetSteps } from '../../_hooks/useSheetSteps';
import { isBarcodeFood } from './foodLibraryPresentation';
import { ensureLibraryFood, isFoodFavorite, setFoodFavorite } from '../../_lib/foodLibrary';
import { activeOwner, workspaceGuard } from '../../_lib/localData';

type Step = 'camera' | 'confirm';

interface BarcodeSearchPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onLog: (entry: FoodEntry) => Promise<void>;
}

export default function BarcodeSearchPopup({ isOpen, onClose, onLog }: BarcodeSearchPopupProps) {
    const { canUseThirdParty } = useCookieConsent();
    const { showToast, retrySync, user } = useAuth();
    const [editing, setEditing] = useState(false);
    const guard = useRef<() => boolean>(() => false);
    const { open, close, refreshHeight, modalRef, overlayRef, handleProps } = useDraggableSheet({ onClose, additionalTransitionProperties: ['scale', 'translate'] });

    const [step, setStep] = useState<Step>('camera');
    const { setTrackRef, painted, changing, onTransitionEnd } = useSheetSteps(step === 'camera' ? 0 : 1);
    const [saving, setSaving] = useState(false);

    const [cameraKey, setCameraKey] = useState(0);
    const [cameraStatus, setCameraStatus] = useState('Scanning...');
    const [cameraList, setCameraList] = useState<MediaDeviceInfo[]>([]);
    const [activeCameraId, setActiveCameraId] = useState<string | undefined>(undefined);

    const [selFood, setSelFood] = useState<FoodSearchResult | null>(null);
    const [amount, setAmount] = useState(100);
    const [unit, setUnit] = useState<FoodAmountUnit>('g');

    const openedRef = useRef(false);

    useEffect(() => {
        if (isOpen) {
            guard.current = workspaceGuard();
            setEditing(false);
            setStep('camera');
        } else {
            guard.current = () => false;
            openedRef.current = false;
            setSelFood(null);
            setAmount(100);
            setUnit('g');
            setCameraStatus('Scanning...');
            setCameraKey(k => k + 1);
            setCameraList([]);
            setActiveCameraId(undefined);
        }
    }, [isOpen]);

    const prevStepRef = useRef<Step | null>(null);
    useEffect(() => {
        if (!isOpen) { prevStepRef.current = null; return; }
        if (prevStepRef.current !== null && prevStepRef.current !== step) {
            refreshHeight();
        }
        prevStepRef.current = step;
    }, [step, isOpen, refreshHeight]);

    useEffect(() => {
        if (isOpen && !openedRef.current && step === 'camera') {
            openedRef.current = true;
            open();
        }
    }, [isOpen, step, open]);

    useEffect(() => {
        if (!isOpen || step !== 'camera') return;
        refreshHeight();
    }, [cameraList.length, isOpen, step, refreshHeight]);

    const selectFood = (food: FoodSearchResult) => {
        setEditing(false);
        setSelFood(food);
        setAmount(food.barcodeAmounts?.basis === 'serving' ? 1 : 100);
        setUnit(food.barcodeAmounts?.basis === 'serving' ? 'serving' : foodAmountUnits(food)[0] || '');
        setStep('confirm');
    };

    const handleScanned = useCallback(async (code: string) => {
        const isCurrent = guard.current;
        if (!canUseThirdParty) {
            setCameraStatus('Barcode lookup requires third-party consent.');
            return;
        }
        setCameraStatus(`Scanned: ${code}`);
        try {
            const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) throw new Error('Barcode lookup failed');
            const data = await res.json();
            if (guard.current !== isCurrent || !isCurrent()) return;
            if (data?.status === 1 && data.product) {
                selectFood(mapBarcodeProduct({ ...data.product, code }));
            } else {
                setCameraStatus('Product not found. Use manual entry below or scan another barcode.');
            }
        } catch {
            if (guard.current === isCurrent && isCurrent()) setCameraStatus('Lookup failed. Use manual entry below or check your connection.');
        }
    }, [canUseThirdParty]);

    const handleClose = useCallback(() => {
        guard.current = () => false;
        close();
    }, [close]);

    let base: ReturnType<typeof foodAmountToBase> | null = null;
    try { if (selFood) base = foodAmountToBase(selFood, amount, unit); } catch {}
    const conversionIssue = selFood ? foodConversionIssue(selFood, unit) : undefined;
    const { kcal: calcKcal, prot: calcProt, carb: calcCarb, fat: calcFat } = selFood && base
        ? foodNutrition(selFood, base.amount) : { kcal: 0, prot: 0, carb: 0, fat: 0 };

    const logFood = async () => {
        if (!selFood || saving || amount <= 0 || !guard.current() || activeOwner() !== (user?.id || 'guest')) return;
        setSaving(true);
        try {
            buildFoodAmountEntry(selFood, amount, unit);
            const saved = ensureLibraryFood({ ...selFood, selectedAmount: { amount, unit } }, undefined, true);
            await onLog(buildFoodAmountEntry(saved, amount, unit));
            void retrySync();
            handleClose();
        } catch {
            showToast('Could not save food locally. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const titles: Record<Step, string> = { camera: 'Scan Barcode', confirm: 'Set Amount' };
    const showBack = step === 'confirm';

    return (<>
        <div
            className="app-overlay"
            id="barcodeSearchOverlay"
            aria-hidden={!isOpen}
            ref={overlayRef}
            onClick={e => { if (e.target === overlayRef.current) handleClose(); }}
        >
            <div className="modal" id="barcodeSearchModal" ref={modalRef} role="dialog" aria-modal="true" aria-label="Barcode scanner" style={{ transform: 'translateY(100%)' }}>
                <div className="modal-handle-zone" id="barcodeSearchHandleZone" {...handleProps}>
                    <div className="modal-handle" />
                </div>

                <div className="modal-header">
                    {showBack && <div className="modal-btn">
                        <button
                            className="back-btn"
                            type="button" aria-label="Back to barcode scanner"
                            onClick={() => { setStep('camera'); setCameraKey(k => k + 1); }}
                        >
                            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
                        </button>
                    </div>}
                    <div className="modal-title">{titles[step]}</div>
                    {!showBack && <div className="modal-btn--right">
                        <button type="button" className="back-btn" aria-label="Close barcode scanner" onClick={handleClose}>
                            <i className="fa-solid fa-xmark" aria-hidden="true" />
                        </button>
                    </div>}
                </div>

                <div className="modal-body" id="barcodeSearchBody">
                    <div className="sheet-step-track" ref={setTrackRef} data-content-changing={changing} onTransitionEnd={onTransitionEnd}
                        style={{ display: 'flex', width: '200%', alignItems: 'flex-start', transform: `translateX(${step === 'camera' ? '0' : '-50%'})` }}>
                    <div inert={step !== 'camera'} aria-hidden={step !== 'camera'} style={{ width: '50%', flexShrink: 0, height: painted(0) ? 'auto' : 0, overflow: 'hidden' }}>
                        <div className="search-step-inner">
                            <div className="camera-sheet" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div className="camera-body">
                                    <div className="camera-preview">
                                        <BarcodeScanner
                                            key={cameraKey}
                                            isOpen={isOpen && step === 'camera'}
                                            onClose={() => {}}
                                            onScanned={handleScanned}
                                            embedded={true}
                                            selectedDeviceId={activeCameraId}
                                            onCamerasChange={(cams, active) => { setCameraList(cams); setActiveCameraId(active); }}
                                            onStatusChange={setCameraStatus}
                                        />
                                        <div className="camera-overlay-frame" />
                                    </div>
                                    {cameraList.length > 1 && (
                                        <select
                                            className="form-input camera-select"
                                            value={activeCameraId}
                                            onChange={e => setActiveCameraId(e.target.value)}
                                        >
                                            {cameraList.map((cam, i) => (
                                                <option key={cam.deviceId || i} value={cam.deviceId}>{friendlyCameraLabel(cam, i)}</option>
                                            ))}
                                        </select>
                                    )}
                                    <div className="search-status" aria-live="polite">{cameraStatus}</div>
                                    <div className="camera-controls">
                                        <button type="button" className="option-btn" onClick={() => {
                                            guard.current = workspaceGuard();
                                            setSelFood({ name: '', kcalPer100: NaN, protPer100: NaN, carbPer100: NaN, fatPer100: NaN, defaultUnit: 'g' }); setStep('confirm'); setEditing(true);
                                        }}>Enter food manually</button>
                                        <button className="option-btn" onClick={() => { setCameraStatus('Scanning...'); setCameraKey(k => k + 1); }}>
                                            <i className="fa-solid fa-rotate" /> Restart
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>


                    <div inert={step !== 'confirm'} aria-hidden={step !== 'confirm'} style={{ width: '50%', flexShrink: 0, height: painted(1) ? 'auto' : 0, overflow: 'hidden' }}>
                    {selFood && (
                        <div className="food-confirm-inner">
                            {!isBarcodeFood(selFood) && (
                                <button type="button" className="option-btn" onClick={() => setEditing(true)}>Edit food details</button>
                            )}
                            {![selFood.kcalPer100, selFood.protPer100, selFood.carbPer100, selFood.fatPer100].every(Number.isFinite) && <p className="food-portion-notice" role="alert">{isBarcodeFood(selFood) ? 'This product has incomplete nutrition. Scan another product or create a food manually.' : 'Nutrition is incomplete. Edit food details before logging.'}</p>}
                            <div className="food-preview-card" id="barcodeSearchPreviewCard">
                                <div className="food-preview-emoji"><i className={selFood.emoji || 'fa-solid fa-utensils'} style={{ color: selFood.color }} /></div>
                                <div className="food-preview-info">
                                    <div className="food-preview-name food-preview-name--with-favorite"><span className="food-preview-name-text">{selFood.name}</span>
                                        <button type="button" className={`food-preview-fav${isFoodFavorite(selFood) ? ' active' : ''}`} aria-label="Favorite food" title={isFoodFavorite(selFood) ? 'Remove from favourites' : 'Save to favourites'} aria-pressed={isFoodFavorite(selFood)} onClick={() => {
                                            if (!guard.current()) return;
                                            try {
                                                const favorite = !isFoodFavorite(selFood);
                                                const saved = ensureLibraryFood({ ...selFood, selectedAmount: { amount, unit } }, undefined, true);
                                                setSelFood({ ...setFoodFavorite(saved, favorite) });
                                                void retrySync();
                                            }
                                            catch { showToast('Complete the food details before saving a favorite.'); }
                                        }}><i className={isFoodFavorite(selFood) ? 'fa-solid fa-star' : 'fa-regular fa-star'} aria-hidden="true" /></button>
                                    </div>
                                    <div className="food-preview-brand">{selFood.brand}</div>
                                    <div className="food-preview-per">{`per ${foodBasisLabel(selFood)}`}</div>
                                </div>
                            </div>

                            <div className="amount-section" id="barcodeSearchAmountSection">
                                <div className="amount-label">Amount / Serving</div>
                                <div className="amount-input-row">
                                    <input
                                        className="amount-big-input" aria-label="Amount"
                                        min={0} step="any"
                                        inputMode="decimal"
                                        type="number"
                                        disabled={!foodAmountUnits(selFood).length}
                                        value={amount}
                                        onChange={e => {
                                            const next = Number(e.target.value);
                                            setAmount(Number.isNaN(next) ? 0 : Math.max(0, next));
                                        }}
                                    />
                                    <select className="form-input barcode-unit-select" aria-label="Amount unit" value={unit} disabled={!foodAmountUnits(selFood).length} onChange={event => {
                                        const next = event.target.value;
                                        try { setAmount(foodAmountToBase(selFood, amount, unit).amount / foodAmountToBase(selFood, 1, next).amount); } catch { /* Preserve input when no reliable conversion exists. */ }
                                        setUnit(next);
                                    }}>{!foodAmountUnits(selFood).length && <option value="">Portion unavailable</option>}{foodAmountUnits(selFood).map(option => <option key={option} value={option}>{foodUnitOptionLabel(selFood, option)}</option>)}</select>
                                </div>
                                {!!foodAmountUnits(selFood).length && <div className="quick-amounts">
                                    {[50, 100, 150, 200, 250, 330, 400, 500].map(v => (
                                        <button key={v} type="button" className="quick-btn" onClick={() => setAmount(v)}>{v}</button>
                                    ))}
                                </div>}
                            </div>

                            {conversionIssue && <p className="food-portion-notice" role="alert"><i className="fa-solid fa-circle-info" aria-hidden="true" /><span>{conversionIssue}</span></p>}
                            <div className="calorie-preview-row" id="barcodeSearchCalorieRow">
                                <div className="calorie-big">
                                    <span>{base ? formatFoodNumber(calcKcal) : '—'}</span>
                                    <span className="calorie-unit-label">kcal</span>
                                </div>
                                <div className="macro-pills">
                                    <div className="macro-pill">P: {base ? formatFoodNumber(calcProt) : '—'}g</div>
                                    <div className="macro-pill">C: {base ? formatFoodNumber(calcCarb) : '—'}g</div>
                                    <div className="macro-pill">F: {base ? formatFoodNumber(calcFat) : '—'}g</div>
                                </div>
                            </div>

                            <div className="nutrition-facts-table" id="barcodeSearchNftTable">
                                <div className="nutrition-facts-header">
                                    <h3 className="nutrition-facts-title">Nutrition Facts</h3>
                                    <div className="nutrition-facts-subtitle">per {foodBasisLabel(selFood)}</div>
                                </div>
                                <div className="nutrition-facts-body">
                                    <div className="nutrition-row nutrition-row-main"><span className="nutrition-label">Energy</span><span className="nutrition-value">{formatFoodNumber(selFood.energyKj)} kJ / {formatFoodNumber(selFood.kcalPer100)} kcal</span></div>
                                    <div className="nutrition-row"><span className="nutrition-label">Fat</span><span className="nutrition-value">{formatFoodNumber(selFood.fatPer100)} g</span></div>
                                    <div className="nutrition-row nutrition-row-sub"><span className="nutrition-label">of which saturates</span><span className="nutrition-value">{selFood.satFatPer100 !== null && selFood.satFatPer100 !== undefined ? `${formatFoodNumber(selFood.satFatPer100)} g` : '-'}</span></div>
                                    <div className="nutrition-row"><span className="nutrition-label">Carbohydrate</span><span className="nutrition-value">{formatFoodNumber(selFood.carbPer100)} g</span></div>
                                    <div className="nutrition-row nutrition-row-sub"><span className="nutrition-label">of which sugars</span><span className="nutrition-value">{selFood.sugarPer100 !== null && selFood.sugarPer100 !== undefined ? `${formatFoodNumber(selFood.sugarPer100)} g` : '-'}</span></div>
                                    <div className="nutrition-row"><span className="nutrition-label">Protein</span><span className="nutrition-value">{formatFoodNumber(selFood.protPer100)} g</span></div>
                                    <div className="nutrition-row"><span className="nutrition-label">Salt</span><span className="nutrition-value">{selFood.saltPer100 !== null && selFood.saltPer100 !== undefined ? `${formatFoodNumber(selFood.saltPer100)} g` : '-'}</span></div>
                                </div>
                            </div>
                        </div>
                    )}
                    </div>
                    </div>
                </div>

                <div className="modal-footer" id="barcodeSearchFooter">
                    <button
                        className="confirm-btn"
                        aria-label="Log food"
                        disabled={step !== 'confirm' || !selFood || saving || editing || !base || !Number.isFinite(amount) || amount <= 0 || ![selFood.kcalPer100, selFood.protPer100, selFood.carbPer100, selFood.fatPer100].every(Number.isFinite)}
                        onClick={() => { if (step === 'confirm' && selFood) logFood(); }}
                    >
                        <svg viewBox="0 -960 960 960" fill="currentColor" height="22" width="22">
                            <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
        {selFood && editing && <FoodReviewEditorSheet food={selFood} onClose={() => setEditing(false)}
            onSaveFood={food => { if (guard.current()) { setSelFood(food); setUnit(food.defaultUnit); } }} />}
    </>);
}
