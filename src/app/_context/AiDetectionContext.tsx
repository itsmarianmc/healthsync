'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { analyzeWithGemini, describeGeminiError, type GeminiAnalysis } from '../_lib/gemini';
import { generateDetectionId } from '../_lib/ids';
import { logger } from '@/lib/logger';

export type DetectionMode = 'describe' | 'import' | 'capture';
export type DetectionStatus = 'awaiting-file' | 'analyzing' | 'completed' | 'error';

export interface Detection {
    id: string;
    mode: DetectionMode;
    status: DetectionStatus;
    result?: GeminiAnalysis;
    errorMessage?: string;
    startedAt: number;
    finishedAt?: number;
}

export interface AiDetectionState {
    detections: Detection[];
    pendingAutoOpenId: string | null;
}

export interface AiDetectionActions {
    isAiDetectionUsable: boolean;
    runDetection: (input: { mode: DetectionMode; text?: string; file?: File }) => string;
    beginAnalysis: (id: string) => void;
    failDetection: (id: string, errorMessage: string) => void;
    consumePendingAutoOpen: () => string | null;
    getDetection: (id: string) => Detection | undefined;
    dismissDetection: (id: string) => void;
}

const AiDetectionContext = createContext<(AiDetectionState & AiDetectionActions) | null>(null);

export function AiDetectionProvider({ children }: { children: React.ReactNode }) {
    const detectionsRef = useRef<Map<string, Detection>>(new Map());
    const [version, setVersion] = useState(0);
    const bump = useCallback(() => setVersion(v => v + 1), []);

    const [pendingAutoOpenId, setPendingAutoOpenId] = useState<string | null>(null);

    const [isAiDetectionUsable, setIsAiDetectionUsable] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const read = () => {
            setIsAiDetectionUsable(
                localStorage.getItem('calsync_ai_enabled') === 'true'
                && !!localStorage.getItem('calsync_ai_api_key'),
            );
        };
        read();
        window.addEventListener('storage', read);
        return () => window.removeEventListener('storage', read);
    }, []);

    const setDetection = useCallback((id: string, patch: Partial<Detection>) => {
        const cur = detectionsRef.current.get(id);
        if (!cur) return;
        detectionsRef.current.set(id, { ...cur, ...patch });
        bump();
    }, [bump]);

    const tryClaimAutoOpen = useCallback((id: string) => {
        setPendingAutoOpenId(prev => (prev ? prev : id));
    }, []);

    const runDetection = useCallback((input: { mode: DetectionMode; text?: string; file?: File }): string => {
        const id = generateDetectionId();
        const initialStatus: DetectionStatus = input.mode === 'describe' ? 'analyzing' : 'awaiting-file';
        detectionsRef.current.set(id, {
            id,
            mode: input.mode,
            status: initialStatus,
            startedAt: Date.now(),
        });
        bump();

        const apiKey = (typeof window !== 'undefined' && localStorage.getItem('calsync_ai_api_key')) || '';
        if (!apiKey) {
            detectionsRef.current.set(id, {
                id,
                mode: input.mode,
                status: 'error',
                errorMessage: 'No API key configured. Add one in Settings.',
                startedAt: Date.now(),
                finishedAt: Date.now(),
            });
            bump();
            tryClaimAutoOpen(id);
            return id;
        }

        (async () => {
            try {
                const geminiMode: 'image' | 'camera' | 'text' =
                    input.mode === 'describe' ? 'text'
                    : input.mode === 'capture' ? 'camera'
                    : 'image';
                const result = await analyzeWithGemini(
                    input.mode === 'describe' ? (input.text || '') : (input.file as File),
                    apiKey,
                    geminiMode,
                    input.mode === 'describe' ? undefined : input.text,
                );
                setDetection(id, { status: 'completed', result, finishedAt: Date.now() });
                tryClaimAutoOpen(id);
            } catch (e) {
                const err = e as Error;
                logger.error('AI analysis failed');
                setDetection(id, {
                    status: 'error',
                    errorMessage: describeGeminiError(err),
                    finishedAt: Date.now(),
                });
                tryClaimAutoOpen(id);
            }
        })();

        return id;
    }, [bump, setDetection, tryClaimAutoOpen]);

    const beginAnalysis = useCallback((id: string) => {
        setDetection(id, { status: 'analyzing' });
    }, [setDetection]);

    const failDetection = useCallback((id: string, errorMessage: string) => {
        setDetection(id, { status: 'error', errorMessage, finishedAt: Date.now() });
        tryClaimAutoOpen(id);
    }, [setDetection, tryClaimAutoOpen]);

    const consumePendingAutoOpen = useCallback(() => {
        let claimed: string | null = null;
        setPendingAutoOpenId(prev => {
            claimed = prev;
            return null;
        });
        return claimed;
    }, []);

    const getDetection = useCallback((id: string) => detectionsRef.current.get(id), []);

    const dismissDetection = useCallback((id: string) => {
        detectionsRef.current.delete(id);
        bump();
    }, [bump]);

    const detections = useMemo(() => {
        version;
        return Array.from(detectionsRef.current.values()).sort((a, b) => b.startedAt - a.startedAt);
    }, [version]);

    const value = useMemo(() => ({
        isAiDetectionUsable,
        detections,
        pendingAutoOpenId,
        runDetection,
        beginAnalysis,
        failDetection,
        consumePendingAutoOpen,
        getDetection,
        dismissDetection,
    }), [isAiDetectionUsable, detections, pendingAutoOpenId, runDetection, beginAnalysis, failDetection, consumePendingAutoOpen, getDetection, dismissDetection]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as unknown as { __aiDetections__?: AiDetectionState }).__aiDetections__ = { detections, pendingAutoOpenId };
        }
    }, [detections, pendingAutoOpenId]);

    return <AiDetectionContext.Provider value={value}>{children}</AiDetectionContext.Provider>;
}

export function useAiDetection() {
    const ctx = useContext(AiDetectionContext);
    if (!ctx) throw new Error('useAiDetection must be used within AiDetectionProvider');
    return ctx;
}
