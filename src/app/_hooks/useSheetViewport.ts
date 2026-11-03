'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';

/** Viewport pans move the frame; only size changes require remeasurement. */
export function useSheetViewport(overlayRef: RefObject<HTMLDivElement | null>, refreshHeight: () => void) {
    const geometry = useRef<{ overlay: HTMLDivElement | null; height: number; width: number }>({ overlay: null, height: -1, width: -1 });
    useLayoutEffect(() => {
        const overlay = overlayRef.current;
        if (!overlay) return;
        if (geometry.current.overlay !== overlay) geometry.current = { overlay, height: -1, width: -1 };
        const viewport = window.visualViewport;
        let frame = 0;
        const update = () => {
            const height = viewport?.height ?? window.innerHeight;
            const width = viewport?.width ?? window.innerWidth;
            overlay.style.top = `${viewport?.offsetTop ?? 0}px`;
            overlay.style.height = `${height}px`;
            overlay.style.bottom = 'auto';
            overlay.style.setProperty('--sheet-viewport-height', `${height}px`);
            if (height !== geometry.current.height || width !== geometry.current.width) {
                geometry.current.height = height; geometry.current.width = width;
                refreshHeight();
            }
        };
        const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
        update();
        viewport?.addEventListener('resize', schedule);
        viewport?.addEventListener('scroll', schedule);
        window.addEventListener('resize', schedule);
        return () => {
            cancelAnimationFrame(frame);
            viewport?.removeEventListener('resize', schedule);
            viewport?.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
        };
    });
}
