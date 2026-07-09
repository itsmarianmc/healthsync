'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import BarcodeScanner from './BarcodeScanner';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import type { FoodEntry } from '../../_lib/types';
import { useCookieConsent } from '../../_lib/useCookieConsent';

const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const INITIAL_H = 429;
const INITIAL_BODY_H = 269;

function parseServingSize(product: Record<string, unknown>): { value: number; unit: 'g' | 'ml' | 'pcs' | null } | null {
    try {
        const s = ((product.serving_size || product.serving_quantity || '') as string);
        const match = s.match(/([\d.,]+)\s*(l|ml|g|kg|oz|cl|pcs|piece|serving)/i);
        if (match) {
            let rawValue = parseFloat(match[1].replace(',', '.'));
            const rawUnit = match[2].toLowerCase();
            let unit: 'g' | 'ml' | 'pcs' | null = null;
            let value = rawValue;

            if (rawUnit === 'l') {
                value = rawValue * 1000;
                unit = 'ml';
            } else if (rawUnit === 'cl') {
                value = rawValue * 10;
                unit = 'ml';
            } else if (rawUnit === 'kg') {
                value = rawValue * 1000;
                unit = 'g';
            } else if (rawUnit === 'oz') {
                value = rawValue * 28.35;
                unit = 'g';
            } else if (rawUnit === 'ml') {
                unit = 'ml';
            } else if (rawUnit === 'g') {
                unit = 'g';
            } else if (rawUnit === 'pcs' || rawUnit === 'piece' || rawUnit === 'serving') {
                unit = 'pcs';
                value = rawValue;
            }

            if (unit && (unit === 'g' || unit === 'ml' || unit === 'pcs')) {
                return { value: Math.round(value), unit };
            }
        }
    } catch {}
    return null;
}

function mapProductToEntry(product: Record<string, any>): FoodEntry {
    const n = (product.nutriments || {}) as Record<string, number>;
    const kcalPer100 = n['energy-kcal_prepared_100g'] || n['energy-kcal_100g'] || n['energy-kcal'] || (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0);
    const protPer100 = n['proteins_prepared_100g'] || n['proteins_100g'] || n['proteins'] || 0;
    const carbPer100 = n['carbohydrates_prepared_100g'] || n['carbohydrates_100g'] || n['carbohydrates'] || 0;
    const fatPer100  = n['fat_prepared_100g'] || n['fat_100g'] || n['fat'] || 0;

    const servingInfo = parseServingSize(product);
    let servingAmount = servingInfo?.value ?? 100;
    let baseUnit: 'g' | 'ml' | 'pcs' = 'g';

    if (servingInfo?.unit === 'ml') {
        baseUnit = 'ml';
    } else if (servingInfo?.unit === 'pcs') {
        baseUnit = 'pcs';
    } else if (servingInfo?.unit === 'g') {
        baseUnit = 'g';
    } else {
        const isLiquid = /beverage|drink|water|juice|milk/i.test(((product.categories_tags || []) as string[]).join(' ')) || /ml|l /i.test(((product.quantity || '') as string).toLowerCase());
        baseUnit = isLiquid ? 'ml' : 'g';
    }

    const kcal = Math.round(kcalPer100 * servingAmount / 100);
    const prot = Math.round(protPer100 * servingAmount / 100 * 10) / 10;
    const carb = Math.round(carbPer100 * servingAmount / 100 * 10) / 10;
    const fat  = Math.round(fatPer100  * servingAmount / 100 * 10) / 10;

    const isLiquid = baseUnit === 'ml';

    return {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        food: (product.product_name || product.product_name_en || 'Unknown Product') as string,
        brand: (product.brands || '') as string,
        emoji: 'fa-solid fa-utensils',
        color: 'var(--accent)',
        kcal,
        amount: servingAmount,
        unit: baseUnit,
        prot,
        carb,
        fat,
        ts: Date.now(),
        date: new Date().toDateString(),
        isDrink: isLiquid,
    };
}

export default function ExtraScanner({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { canUseThirdParty } = useCookieConsent();
    const sheet = useDraggableSheet({ onClose });

    const [cameraActive, setCameraActive] = useState(false);
    const [entry, setEntry] = useState<FoodEntry | null>(null);
    const [modalStep, setModalStep] = useState<3 | 4>(3);
    const [amount, setAmount] = useState(100);
    const [unit, setUnit] = useState<'g' | 'ml' | 'pcs'>('g');

    const bodyRef = useRef<HTMLDivElement>(null);
    const step3Ref = useRef<HTMLDivElement>(null);
    const step4Ref = useRef<HTMLDivElement>(null);
    const naturalH = useRef(INITIAL_H);
    const bodyHRef = useRef(INITIAL_BODY_H);
    const isAnimating = useRef(false);

    useEffect(() => {
        const modal = sheet.modalRef.current;
        const body = bodyRef.current;
        if (!modal || !body || sheet.stateRef.current === 'closed') return;
        if (sheet.stateRef.current === 'expanded') return;
        if (naturalH.current === 0) return;

        const stepEl = modalStep === 3 ? step3Ref.current : step4Ref.current;
        if (!stepEl) return;
        const newBodyH = stepEl.offsetHeight;
        if (newBodyH === 0) return;

        bodyHRef.current = newBodyH;
        const fixedH = Math.max(0, naturalH.current - body.offsetHeight);
        const newTotalH = fixedH + newBodyH;
        naturalH.current = newTotalH;

        body.style.transition = `height 0.38s ${EASE}`;
        body.style.height = newBodyH + 'px';
        modal.style.transition = `height 0.38s ${EASE}`;
        modal.style.height = newTotalH + 'px';

        const t = setTimeout(() => {
            if (body) body.style.transition = '';
            if (modal) modal.style.transition = '';
        }, 400);
        return () => clearTimeout(t);
    }, [modalStep, entry]);

    const handleClose = useCallback(() => {
        sheet.close();
    }, [sheet]);

    useEffect(() => {
        if (isOpen) {
            setCameraActive(true);
            setEntry(null);
            setModalStep(3);
            naturalH.current = INITIAL_H;
            bodyHRef.current = INITIAL_BODY_H;
            sheet.open();
        } else {
            setCameraActive(false);
            setEntry(null);
            setModalStep(3);
        }
    }, [isOpen]);

    const handleScanned = async (code: string) => {
        if (!canUseThirdParty) {
            console.warn('Barcode lookup requires third-party consent.');
            setCameraActive(false);
            return;
        }
        try {
            const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`);
            const data = await res.json();
            if (data?.status === 1 && data.product) {
                const mapped = mapProductToEntry(data.product);
                try { window.dispatchEvent(new CustomEvent('sym:logFood', { detail: mapped })); } catch {}
                setEntry(mapped);
                setAmount(mapped.amount ?? 100);
                setUnit((mapped.unit as 'g' | 'ml' | 'pcs') ?? 'g');
                setModalStep(4);
            }
        } catch (e) {
            console.error('Failed to fetch product data:', e);
        }
        finally {
            setCameraActive(false);
        }
    };

    const handleScanAgain = () => {
        setModalStep(3);
        setEntry(null);
        setCameraActive(true);
    };

    const handleUnitChange = useCallback((newUnit: 'g' | 'ml' | 'pcs') => {
        if (!entry) return;
        if (entry.isDrink && ((unit === 'g' && newUnit === 'ml') || (unit === 'ml' && newUnit === 'g'))) {
            setAmount(amount);
        } else if (unit === 'pcs' || newUnit === 'pcs') {
            setAmount(amount);
        }
        setUnit(newUnit);
    }, [entry, unit, amount]);

    const renderAmount = entry ? amount : 100;
    const renderUnit = entry ? unit : 'g';
    const ratio = entry ? (amount / Math.max(1, entry.amount ?? 100)) : 1;
    const calculatedKcal = entry ? Math.round(entry.kcal * ratio) : 0;
    const calculatedProt = entry ? Math.round(entry.prot * ratio * 10) / 10 : 0;
    const calculatedCarb = entry ? Math.round(entry.carb * ratio * 10) / 10 : 0;
    const calculatedFat = entry ? Math.round(entry.fat * ratio * 10) / 10 : 0;
    const fixedPer100Kcal = entry ? Math.round(entry.kcal * 100 / Math.max(1, entry.amount ?? 100)) : 0;
    const fixedPer100Prot = entry ? Math.round(entry.prot * 100 / Math.max(1, entry.amount ?? 100) * 10) / 10 : 0;
    const fixedPer100Carb = entry ? Math.round(entry.carb * 100 / Math.max(1, entry.amount ?? 100) * 10) / 10 : 0;
    const fixedPer100Fat = entry ? Math.round(entry.fat * 100 / Math.max(1, entry.amount ?? 100) * 10) / 10 : 0;

    const transformPercent = modalStep === 3 ? 50 : 75;
    const isConfirmStep = modalStep === 4 && !!entry;

    return (
        <div
            className="app-overlay"
            id="appOverlay"
            ref={sheet.overlayRef}
            onClick={e => { if (e.target === sheet.overlayRef.current) handleClose(); }}
            >
            <div
                className="modal"
                id="modal"
                ref={sheet.modalRef}
                style={{ height: INITIAL_H, transform: 'translateY(100%)' }}
                >
                <div className="modal-handle-zone" id="handleZone" {...sheet.handleProps}>
                    <div className="modal-handle" />
                </div>

                <div className="modal-header">
                    <div className="modal-btn">
                        <button
                            className="back-btn"
                            id="backBtn"
                            style={{ opacity: modalStep === 4 ? 1 : 0, pointerEvents: modalStep === 4 ? 'auto' : 'none' }}
                            onClick={handleScanAgain}
                            >
                            <svg height="18" viewBox="0 -960 960 960" width="18" fill="currentColor">
                                <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
                            </svg>
                        </button>
                    </div>
                    <div className="modal-title" id="modalTitle">Add Food</div>
                </div>

                <div className="modal-body" id="modalBody" ref={bodyRef} style={{ height: INITIAL_BODY_H }}>
                    <div style={{
                        display: 'flex',
                        width: '400%',
                        alignItems: 'flex-start',
                        transform: `translateX(-${transformPercent}%)`,
                        transition: `transform 0.38s ${EASE}`,
                        }}>
                        <div className="modal-step" style={{ display: 'block', width: '25%', flexShrink: 0 }} />
                        <div className="modal-step" style={{ display: 'block', width: '25%', flexShrink: 0 }} />

                        <div className="modal-step" id="cs-step3" ref={step3Ref} style={{ display: 'block', width: '25%', flexShrink: 0 }}>
                            <div className="search-step-inner">
                                <div className="camera-sheet" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div className="camera-body">
                                        <div className="camera-preview">
                                            {cameraActive && (
                                                <BarcodeScanner
                                                isOpen={true}
                                                onClose={() => setCameraActive(false)}
                                                onScanned={handleScanned}
                                                embedded={true}
                                                />
                                            )}
                                            <div className="camera-overlay-frame" />
                                        </div>
                                        <div className="camera-status">Scanning...</div>
                                        <div className="camera-controls">
                                            <button className="option-btn"><i className="fa-solid fa-rotate" /> Restart</button>
                                            <button className="option-btn"><i className="fa-solid fa-camera-rotate" /> Switch</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-step" id="cs-step4" ref={step4Ref} style={{ display: 'block', width: '25%', flexShrink: 0 }}>
                            <div className="search-step-inner" style={{ padding: '0 !important'}}>
                                {entry ? (
                                <div className="food-confirm-inner">
                                    <div className="food-preview-card" id="foodPreviewCard">
                                        <div className="food-preview-emoji" id="foodPreviewEmoji">
                                            <i className={entry.emoji || 'fa-solid fa-utensils'} style={{ color: entry.color }} />
                                        </div>
                                        <div className="food-preview-info">
                                            <div className="food-preview-name" id="foodPreviewName">{entry.food}</div>
                                            <div className="food-preview-brand" id="foodPreviewBrand">{entry.brand}</div>
                                            <div className="food-preview-per" id="foodPreviewPer">per {entry.unit}</div>
                                        </div>
                                    </div>
                                    <div className="amount-section" id="amount-section">
                                        <div className="amount-label">Amount / Serving</div>
                                        <div className="amount-input-row">
                                            <input
                                                id="amountInput"
                                                className="amount-big-input"
                                                min={0} max={9999}
                                                inputMode="decimal"
                                                type="number"
                                                value={renderAmount}
                                                onChange={e => {
                                                    const next = Number(e.target.value);
                                                    setAmount(Number.isNaN(next) ? 0 : Math.max(0, Math.min(9999, next)));
                                                }}
                                            />
                                            <div className="amount-unit-toggle">
                                                <button
                                                    className={`unit-btn${renderUnit === 'g' ? ' active' : ''}`}
                                                    type="button"
                                                    onClick={() => handleUnitChange('g')}
                                                >g</button>
                                                <button
                                                    className={`unit-btn${renderUnit === 'ml' ? ' active' : ''}`}
                                                    type="button"
                                                    onClick={() => handleUnitChange('ml')}
                                                >ml</button>
                                                <button
                                                    className={`unit-btn${renderUnit === 'pcs' ? ' active' : ''}`}
                                                    type="button"
                                                    onClick={() => handleUnitChange('pcs')}
                                                >pcs</button>
                                            </div>
                                        </div>
                                        <div className="quick-amounts">
                                            {[50, 100, 150, 200, 250, 330, 400, 500].map(v => (
                                                <button
                                                    key={v}
                                                    type="button"
                                                    className="quick-btn"
                                                    onClick={() => setAmount(v)}
                                                >{v}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="calorie-preview-row" id="caloriePreviewRow">
                                        <div className="calorie-big">
                                            <span id="calculatedCalories">{calculatedKcal}</span>
                                            <span className="calorie-unit-label">kcal</span>
                                        </div>
                                        <div className="macro-pills" id="macroPills">
                                            <div className="macro-pill">P: {calculatedProt}g</div>
                                            <div className="macro-pill">C: {calculatedCarb}g</div>
                                            <div className="macro-pill">F: {calculatedFat}g</div>
                                        </div>
                                    </div>
                                    <div className="nutrition-facts-table" id="nutritionFactsTable">
                                        <div className="nutrition-facts-header">
                                            <h3 className="nutrition-facts-title">Nutrition Facts</h3>
                                            <div className="nutrition-facts-subtitle">per 100<span id="nftUnit">{renderUnit}</span></div>
                                        </div>
                                        <div className="nutrition-facts-body">
                                            <div className="nutrition-row nutrition-row-main"><span className="nutrition-label">Energy</span><span className="nutrition-value" id="nftEnergy">{fixedPer100Kcal} kcal</span></div>
                                            <div className="nutrition-row"><span className="nutrition-label">Fat</span><span className="nutrition-value"><span id="nftFat">{fixedPer100Fat}</span> g</span></div>
                                            <div className="nutrition-row nutrition-row-sub"><span className="nutrition-label">of which saturates</span><span className="nutrition-value" id="nftSatFat">-</span></div>
                                            <div className="nutrition-row"><span className="nutrition-label">Carbohydrate</span><span className="nutrition-value"><span id="nftCarbs">{fixedPer100Carb}</span> g</span></div>
                                            <div className="nutrition-row nutrition-row-sub"><span className="nutrition-label">of which sugars</span><span className="nutrition-value" id="nftSugar">-</span></div>
                                            <div className="nutrition-row"><span className="nutrition-label">Protein</span><span className="nutrition-value"><span id="nftProtein">{fixedPer100Prot}</span> g</span></div>
                                            <div className="nutrition-row"><span className="nutrition-label">Salt</span><span className="nutrition-value" id="nftSalt">-</span></div>
                                        </div>
                                    </div>
                                </div>
                                ) : (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text2)' }}>Loading...</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="modal-footer" id="modalFooter">
                    <button
                        className="confirm-btn"
                        id="actionBtn"
                        disabled={!isConfirmStep}
                        onClick={() => { if (isConfirmStep) handleClose(); }}
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