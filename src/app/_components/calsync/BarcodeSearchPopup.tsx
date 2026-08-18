'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import BarcodeScanner from './BarcodeScanner';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { useCookieConsent } from '../../_lib/useCookieConsent';
import { useAuth } from '../../_context/AuthContext';
import { friendlyCameraLabel } from '../../_lib/camera';
import { generateEntryId } from '../../_lib/ids';
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

const SKEL = (
    <div className="skeleton-item">
        <div className="skeleton-icon" />
        <div className="skeleton-info">
            <div className="skeleton-line name" />
            <div className="skeleton-line brand" />
        </div>
        <div className="skeleton-kcal" />
    </div>
);

type Step = 'search' | 'camera' | 'confirm';

interface BarcodeSearchPopupProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: 'search' | 'camera';
}

export default function BarcodeSearchPopup({ isOpen, onClose, initialMode = 'search' }: BarcodeSearchPopupProps) {
    const { canUseThirdParty } = useCookieConsent();
    const { showToast } = useAuth();
    const sheet = useDraggableSheet({ onClose });

    const [step, setStep] = useState<Step>('search');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<FoodSearchResult[]>([]);
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    const [cameraKey, setCameraKey] = useState(0);
    const [cameraStatus, setCameraStatus] = useState('Scanning...');
    const [cameraList, setCameraList] = useState<MediaDeviceInfo[]>([]);
    const [activeCameraId, setActiveCameraId] = useState<string | undefined>(undefined);

    const [selFood, setSelFood] = useState<FoodSearchResult | null>(null);
    const [amount, setAmount] = useState(100);
    const [unit, setUnit] = useState<'g' | 'ml' | 'pcs'>('g');

    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchAbortRef = useRef<AbortController | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const openedRef = useRef(false);

    useEffect(() => {
        if (isOpen) {
            setStep(initialMode);
            if (initialMode === 'search') setTimeout(() => inputRef.current?.focus(), 350);
        } else {
            if (searchTimer.current) { clearTimeout(searchTimer.current); searchTimer.current = null; }
            if (searchAbortRef.current) { searchAbortRef.current.abort(); searchAbortRef.current = null; }
            openedRef.current = false;
            setQuery('');
            setResults([]);
            setStatus('');
            setLoading(false);
            setSelFood(null);
            setAmount(100);
            setUnit('g');
            setCameraStatus('Scanning...');
            setCameraKey(k => k + 1);
            setCameraList([]);
            setActiveCameraId(undefined);
        }
    }, [isOpen, initialMode]);

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
        if (isOpen && !openedRef.current && step === initialMode) {
            openedRef.current = true;
            sheet.open();
        }
    }, [isOpen, step, initialMode, sheet]);

    useEffect(() => {
        if (!isOpen || step !== 'camera') return;
        sheet.refreshHeight();
    }, [cameraList.length, isOpen, sheet]);

    const runSearch = useCallback(async (q: string) => {
        if (!canUseThirdParty) {
            setStatus('Search requires third-party consent.');
            return;
        }
        if (!q.trim()) { setResults([]); setStatus(''); return; }

        if (searchAbortRef.current) searchAbortRef.current.abort();
        const controller = new AbortController();
        searchAbortRef.current = controller;

        setLoading(true); setStatus('');
        try {
            const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=10&fields=product_name,product_name_en,brands,nutriments,serving_size,serving_quantity,quantity,categories_tags,code`;
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok) throw new Error(`http_${res.status}`);
            const data = await res.json();
            if (controller.signal.aborted) return;
            const products = (data.products || []) as Record<string, unknown>[];
            setLoading(false);
            if (!products.length) { setResults([]); setStatus('No results. Try a different term.'); return; }
            setResults(products.map(mapProduct));
        } catch (err) {
            if ((err as { name?: string })?.name === 'AbortError') return;
            setLoading(false);
            setResults([]);
            setStatus('Search failed. Check your connection.');
        }
    }, [canUseThirdParty]);

    const handleInput = (v: string) => {
        setQuery(v);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        if (!v.trim()) { setResults([]); setStatus(''); return; }
        searchTimer.current = setTimeout(() => runSearch(v), 400);
    };

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
                setCameraStatus('Product not found. Try again or search by name.');
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

    const ratio = selFood ? amount / 100 : 1;
    const calcKcal = selFood ? Math.round(selFood.kcalPer100 * ratio) : 0;
    const calcProt = selFood ? Math.round(selFood.protPer100 * ratio * 10) / 10 : 0;
    const calcCarb = selFood ? Math.round(selFood.carbPer100 * ratio * 10) / 10 : 0;
    const calcFat = selFood ? Math.round(selFood.fatPer100 * ratio * 10) / 10 : 0;

    const logFood = () => {
        if (!selFood) return;
        const entry: FoodEntry = {
            id: generateEntryId(),
            food: selFood.name,
            brand: selFood.brand || '',
            emoji: selFood.emoji || 'fa-solid fa-utensils',
            color: selFood.color || 'var(--accent)',
            kcal: calcKcal,
            amount: Math.round(amount),
            unit,
            prot: calcProt,
            carb: calcCarb,
            fat: calcFat,
            ts: Date.now(),
            date: new Date().toDateString(),
            isDrink: !!selFood.isLiquid,
            isBarcode: !!selFood.isBarcode,
            barcode: selFood.barcode,
        };
        try { window.dispatchEvent(new CustomEvent('sym:logFood', { detail: entry })); } catch {}
        showToast(`${calcKcal} kcal logged`);
        handleClose();
    };

    const titles: Record<Step, string> = { search: 'Search Food', camera: 'Scan Barcode', confirm: 'Set Amount' };
    const showBack = step === 'confirm';

    return (
        <div
            className="app-overlay"
            id="barcodeSearchOverlay"
            ref={sheet.overlayRef}
            onClick={e => { if (e.target === sheet.overlayRef.current) handleClose(); }}
        >
            <div className="modal" id="barcodeSearchModal" ref={sheet.modalRef} style={{ transform: 'translateY(100%)' }}>
                <div className="modal-handle-zone" id="barcodeSearchHandleZone" {...sheet.handleProps}>
                    <div className="modal-handle" />
                </div>

                <div className="modal-header">
                    <div className="modal-btn">
                        <button
                            className="back-btn"
                            style={{ opacity: showBack ? 1 : 0, pointerEvents: showBack ? 'auto' : 'none' }}
                            onClick={() => { setStep(initialMode); setSelFood(null); if (initialMode === 'camera') setCameraKey(k => k + 1); }}
                        >
                            <svg height="18" viewBox="0 -960 960 960" width="18" fill="currentColor">
                                <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
                            </svg>
                        </button>
                    </div>
                    <div className="modal-title">{titles[step]}</div>
                    <div className="modal-btn--right">
                        {step === 'search' && (
                            <button className="back-btn" style={{ background: 'var(--surface3)' }} title="Scan Barcode"
                                onClick={() => { setStep('camera'); setCameraStatus('Scanning...'); setCameraKey(k => k + 1); }}>
                                <i className="fa-solid fa-barcode" />
                            </button>
                        )}
                        {step === 'camera' && (
                            <button className="back-btn" style={{ background: 'var(--surface3)' }} title="Search by name"
                                onClick={() => setStep('search')}>
                                <i className="fa-solid fa-magnifying-glass" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="modal-body" id="barcodeSearchBody">
                    {step === 'search' && (
                        <div className="search-step-inner">
                            <div className="search-row">
                                <div className="search-elements" id="barcodeSearchElements">
                                    <div className="search-input-wrap" id="barcodeSearchInputWrap">
                                        <i className="fa-solid fa-magnifying-glass search-icon" />
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            id="barcodeSearchInput"
                                            className="food-search-input"
                                            placeholder="Search food or product name..."
                                            autoComplete="off"
                                            value={query}
                                            onChange={e => handleInput(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {status && <div id="barcodeSearchStatus" className="search-status active">{status}</div>}

                            <div id="barcodeSearchResults" className="search-results">
                                {loading && [0, 1, 2].map(i => <React.Fragment key={i}>{SKEL}</React.Fragment>)}
                                {!loading && results.map((food, i) => (
                                    <div key={i} className="search-result-item" onClick={() => selectFood(food)}>
                                        <div className="search-result-icon"><i className={food.emoji || 'fa-solid fa-utensils'} /></div>
                                        <div className="search-result-info">
                                            <div className="search-result-name">{food.name}</div>
                                            {food.brand && <div className="search-result-brand">{food.brand}</div>}
                                        </div>
                                        <div className="search-result-kcal">{food.kcalPer100 ? `${Math.round(food.kcalPer100)} kcal/100${food.defaultUnit}` : '? kcal'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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
                        disabled={step !== 'confirm' || !selFood}
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
