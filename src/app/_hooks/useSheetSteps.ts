'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type TransitionEvent } from 'react';

export function useSheetSteps(step: number) {
    const trackRef = useRef<HTMLDivElement>(null);
    const setTrackRef = useCallback((node: HTMLDivElement | null) => { trackRef.current = node; }, []);
    const [motion, setMotion] = useState({ step, leaving: [] as number[] });
    if (motion.step !== step) setMotion({ step, leaving: [...new Set([...motion.leaving, motion.step])].filter(index => index !== step) });
    const finish = () => setMotion(current => current.leaving.length ? { ...current, leaving: [] } : current);

    useLayoutEffect(() => {
        const track = trackRef.current;
        const active = track?.children[step] as HTMLElement | undefined;
        if (!track || !active) return;
        const measure = () => {
            const target = `${active.offsetHeight}px`;
            if (track.style.height === target) return;
            const phase = track.closest('[data-sheet-phase]')?.getAttribute('data-sheet-phase');
            if (phase !== 'open') track.style.transition = 'none';
            track.style.height = target;
            if (phase !== 'open') { void track.offsetHeight; track.style.transition = ''; }
        };
        measure();
        const resize = new ResizeObserver(measure);
        resize.observe(active);
        return () => resize.disconnect();
    }, [step]);

    useEffect(() => {
        if (!motion.leaving.length) return;
        const timer = setTimeout(() => setMotion(current => current.step === motion.step ? { ...current, leaving: [] } : current),
            matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500);
        return () => clearTimeout(timer);
    }, [motion.step, motion.leaving]);

    return {
        setTrackRef,
        painted: (index: number) => index === step || motion.leaving.includes(index),
        changing: motion.leaving.length > 0,
        onTransitionEnd: (event: TransitionEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget && event.propertyName === 'transform') finish();
        },
    };
}
