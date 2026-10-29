'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import BarcodeScanner from './BarcodeScanner';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { useCookieConsent } from '../../_lib/useCookieConsent';
import { useAuth } from '../../_context/AuthContext';
import { friendlyCameraLabel } from '../../_lib/camera';
import { buildFoodEntry, foodNutrition } from '../../_lib/foodEntry';
import type { FoodEntry, FoodSearchResult } from '../../_lib/types';

function toFiniteNumber(value: unknown, fallback = 0): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function toNullableFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

function mapProduct(product: Record<string, unknown>): FoodSearchResult {
    const n = (product.nutriments || {}) as Record<string, number>;
    const kcalPer100 = toFiniteNumber(n['energy-kcal_prepared_100g'] || n['energy-kcal_100g'] || n['energy-kcal'] || (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0));
    const protPer100 = toFiniteNumber(n['proteins_prepared_100g'] || n['proteins_100g'] || n['proteins'] || 0);
    const carbPer100 = toFiniteNumber(n['carbohydrates_prepared_100g'] || n['carbohydrates_100g'] || n['carbohydrates'] || 0);
    const fatPer100 = toFiniteNumber(n['fat_prepared_100g'] || n['fat_100g'] || n['fat'] || 0);
    const energyKj = toFiniteNumber(n['energy-kj_prepared_100g'] || n['energy-kj_100g'] || n['energy-kj'] || (kcalPer100 * 4.184));
    const satFatPer100 = toNullableFiniteNumber(n['saturated-fat_prepared_100g'] ?? n['saturated-fat_100g'] ?? n['saturated-fat']);
    const sugarPer100 = toNullableFiniteNumber(n['sugars_prepared_100g'] ?? n['sugars_100g'] ?? n['sugars']);
    let saltPer100 = toNullableFiniteNumber(n['salt_prepared_100g'] ?? n['salt_100g'] ?? n['salt']);
    if (saltPer100 === null && (n['sodium_prepared_100g'] || n['sodium_100g'])) saltPer100 = toNullableFiniteNumber((n['sodium_prepared_100g'] || n['sodium_100g']) * 2.5);
    const categories = ((product.categories_tags as string[]) || []).join(' ');
    const quantityStr = ((product.quantity || '') as string).toLowerCase();
    const isLiquid = /beverage|drink|water|juice|milk/i.test(categories) || /\bml\b|\bl\b/i.test(quantityStr);

    return {
        name: (product.product_name || product.product_name_en || 'Unknown Product') as string,
        brand: (product.brands || '') as string,
        kcalPer100: Math.round(kcalPer100 * 10) / 10,
        protPer100: Math.round(protPer100 * 10) / 10,
        carbPer100: Math.round(carbPer100 * 10) / 10,
        fatPer100: Math.round(fatPer100 * 10) / 10,
        satFatPer100: satFatPer100 !== null ? Math.round(satFatPer100 * 10) / 10 : null,
        sugarPer100: sugarPer100 !== null ? Math.round(sugarPer100 * 10) / 10 : null,
        saltPer100: saltPer100 !== null ? Math.round(saltPer100 * 1000) / 1000 : null,
        energyKj: Math.round(energyKj),
        emoji: 'fa-solid fa-utensils',
        color: 'var(--accent)',
        isLiquid,
        defaultUnit: isLiquid ? 'ml' : 'g',
        isBarcode: true,
        barcode: ((product.code as string) || '') || undefined,
    };
}

type Step = 'camera' | 'confirm';

interface BarcodeSearchPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onLog: (entry: FoodEntry) => Promise<void>;
}

export default function BarcodeSearchPopup({ isOpen, onClose, onLog }: BarcodeSearchPopupProps) {
    const { canUseThirdParty } = useCookieConsent();
    const { showToast } = useAuth();
    const sheet = useDraggableSheet({ onClose });

    const [step, setStep] = useState<Step>('camera');
    const [saving, setSaving] = useState(false);

    const [cameraKey, setCameraKey] = useState(0);
    const [cameraStatus, setCameraStatus] = useState('Scanning...');
    const [cameraList, setCameraList] = useState<MediaDeviceInfo[]>([]);
    const [activeCameraId, setActiveCameraId] = useState<string | undefined>(undefined);

    const [selFood, setSelFood] = useState<FoodSearchResult | null>(null);
    const [amount, setAmount] = useState(100);
    const [unit, setUnit] = useState<'g' | 'ml' | 'pcs'>('g');

    const openedRef = useRef(false);

    useEffect(() => {
        if (isOpen) {
            setStep('camera');
        } else {
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
            sheet.refreshHeight();
        }
        prevStepRef.current = step;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, isOpen]);

    useEffect(() => {
        if (isOpen && !openedRef.current && step === 'camera') {
            openedRef.current = true;
            sheet.open();
        }
    }, [isOpen, step, sheet]);

    useEffect(() => {
        if (!isOpen || step !== 'camera') return;
        sheet.refreshHeight();
    }, [cameraList.length, isOpen, sheet]);

    const selectFood = (food: FoodSearchResult) => {
        setSelFood(food);
        setAmount(100);
        setUnit((food.defaultUnit as 'g' | 'ml' | 'pcs') || 'g');
        setStep('confirm');
    };

    const handleScanned = useCallback(async (code: string) => {
        if (!canUseThirdParty) {
            setCameraStatus('Barcode lookup requires third-party consent.');
            return;
        }
        setCameraStatus(`Scanned: ${code}`);
        try {
            const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`);
            const data = await res.json();
            if (data?.status === 1 && data.product) {
                selectFood(mapProduct({ ...data.product, code }));
            } else {
                setCameraStatus('Product not found. Try another barcode.');
                setTimeout(() => { setCameraStatus('Scanning...'); setCameraKey(k => k + 1); }, 1500);
            }
        } catch {
            setCameraStatus('Lookup failed. Check your connection.');
            setTimeout(() => { setCameraStatus('Scanning...'); setCameraKey(k => k + 1); }, 1500);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canUseThirdParty]);

    const handleClose = useCallback(() => {
        sheet.close();
    }, [sheet]);

    const { kcal: calcKcal, prot: calcProt, carb: calcCarb, fat: calcFat } = selFood
        ? foodNutrition(selFood, amount) : { kcal: 0, prot: 0, carb: 0, fat: 0 };

    const logFood = async () => {
        if (!selFood || saving || amount <= 0) return;
        setSaving(true);
        try {
            await onLog(buildFoodEntry(selFood, amount, unit));
            handleClose();
        } catch {
            showToast('Could not save food locally. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const titles: Record<Step, string> = { camera: 'Scan Barcode', confirm: 'Set Amount' };
    const showBack = step === 'confirm';

    return (
        <div
            className="app-overlay"
            id="barcodeSearchOverlay"
            aria-hidden={!isOpen}
            ref={sheet.overlayRef}
            onClick={e => { if (e.target === sheet.overlayRef.current) handleClose(); }}
        >
            <div className="modal" id="barcodeSearchModal" ref={sheet.modalRef} role="dialog" aria-modal="true" aria-label="Barcode scanner" style={{ transform: 'translateY(100%)' }}>
                <div className="modal-handle-zone" id="barcodeSearchHandleZone" {...sheet.handleProps}>
                    <div className="modal-handle" />
                </div>

                <div className="modal-header">
                    <div className="modal-btn">
                        <button
                            className="back-btn"
                            style={{ opacity: showBack ? 1 : 0, pointerEvents: showBack ? 'auto' : 'none' }}
                            onClick={() => { setStep('camera'); setSelFood(null); setCameraKey(k => k + 1); }}
                        >
                            <svg height="18" viewBox="0 -960 960 960" width="18" fill="currentColor">
                                <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
                            </svg>
                        </button>
                    </div>
                    <div className="modal-title">{titles[step]}</div>
                    <div className="modal-btn--right">
                        <button type="button" className="back-btn" aria-label="Close barcode scanner" onClick={handleClose}>
                            <i className="fa-solid fa-xmark" aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <div className="modal-body" id="barcodeSearchBody">
                    {step === 'camera' && (
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
                                        <button className="option-btn" onClick={() => { setCameraStatus('Scanning...'); setCameraKey(k => k + 1); }}>
                                            <i className="fa-solid fa-rotate" /> Restart
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}


                    {step === 'confirm' && selFood && (
                        <div className="food-confirm-inner">
                            <div className="food-preview-card" id="barcodeSearchPreviewCard">
                                <div className="food-preview-emoji"><i className={selFood.emoji || 'fa-solid fa-utensils'} style={{ color: selFood.color }} /></div>
                                <div className="food-preview-info">
                                    <div className="food-preview-name">{selFood.name}</div>
                                    <div className="food-preview-brand">{selFood.brand}</div>
                                    <div className="food-preview-per">{`per 100${selFood.defaultUnit}`}</div>
                                </div>
                            </div>

                            <div className="amount-section" id="barcodeSearchAmountSection">
                                <div className="amount-label">Amount / Serving</div>
                                <div className="amount-input-row">
                                    <input
                                        className="amount-big-input"
                                        min={0} max={9999}
                                        inputMode="decimal"
                                        type="number"
                                        value={amount}
                                        onChange={e => {
                                            const next = Number(e.target.value);
                                            setAmount(Number.isNaN(next) ? 0 : Math.max(0, Math.min(9999, next)));
                                        }}
                                    />
                                    <div className="amount-unit-toggle">
                                        <button className={`unit-btn${unit === 'g' ? ' active' : ''}`} type="button" onClick={() => setUnit('g')}>g</button>
                                        <button className={`unit-btn${unit === 'ml' ? ' active' : ''}`} type="button" onClick={() => setUnit('ml')}>ml</button>
                                        <button className={`unit-btn${unit === 'pcs' ? ' active' : ''}`} type="button" onClick={() => setUnit('pcs')}>pcs</button>
                                    </div>
                                </div>
                                <div className="quick-amounts">
                                    {[50, 100, 150, 200, 250, 330, 400, 500].map(v => (
                                        <button key={v} type="button" className="quick-btn" onClick={() => setAmount(v)}>{v}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="calorie-preview-row" id="barcodeSearchCalorieRow">
                                <div className="calorie-big">
                                    <span>{calcKcal}</span>
                                    <span className="calorie-unit-label">kcal</span>
                                </div>
                                <div className="macro-pills">
                                    <div className="macro-pill">P: {calcProt}g</div>
                                    <div className="macro-pill">C: {calcCarb}g</div>
                                    <div className="macro-pill">F: {calcFat}g</div>
                                </div>
                            </div>

                            <div className="nutrition-facts-table" id="barcodeSearchNftTable">
                                <div className="nutrition-facts-header">
                                    <h3 className="nutrition-facts-title">Nutrition Facts</h3>
                                    <div className="nutrition-facts-subtitle">per 100<span>{selFood.defaultUnit}</span></div>
                                </div>
                                <div className="nutrition-facts-body">
                                    <div className="nutrition-row nutrition-row-main"><span className="nutrition-label">Energy</span><span className="nutrition-value">{selFood.energyKj} kJ / {selFood.kcalPer100} kcal</span></div>
                                    <div className="nutrition-row"><span className="nutrition-label">Fat</span><span className="nutrition-value">{selFood.fatPer100} g</span></div>
                                    <div className="nutrition-row nutrition-row-sub"><span className="nutrition-label">of which saturates</span><span className="nutrition-value">{selFood.satFatPer100 !== null && selFood.satFatPer100 !== undefined ? `${selFood.satFatPer100} g` : '-'}</span></div>
                                    <div className="nutrition-row"><span className="nutrition-label">Carbohydrate</span><span className="nutrition-value">{selFood.carbPer100} g</span></div>
                                    <div className="nutrition-row nutrition-row-sub"><span className="nutrition-label">of which sugars</span><span className="nutrition-value">{selFood.sugarPer100 !== null && selFood.sugarPer100 !== undefined ? `${selFood.sugarPer100} g` : '-'}</span></div>
                                    <div className="nutrition-row"><span className="nutrition-label">Protein</span><span className="nutrition-value">{selFood.protPer100} g</span></div>
                                    <div className="nutrition-row"><span className="nutrition-label">Salt</span><span className="nutrition-value">{selFood.saltPer100 !== null && selFood.saltPer100 !== undefined ? `${selFood.saltPer100} g` : '-'}</span></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="modal-footer" id="barcodeSearchFooter">
                    <button
                        className="confirm-btn"
                        aria-label="Log food"
                        disabled={step !== 'confirm' || !selFood || saving || amount <= 0}
                        onClick={() => { if (step === 'confirm' && selFood) logFood(); }}
                    >
                        <svg viewBox="0 -960 960 960" fill="currentColor" height="22" width="22">
                            <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
