'use client';

import { useEffect, useRef, useState } from 'react';

interface PullToRefreshProps {
    onRefresh?: () => Promise<void>;
}

const THRESHOLD = 60;
const MAX_HEIGHT = 80;
const RESISTANCE = 0.5;

export default function PullToRefresh({ onRefresh }: PullToRefreshProps) {
    const [height, setHeight] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const startYRef = useRef(0);
    const pullingRef = useRef(false);
    const heightRef = useRef(0);
    const refreshingRef = useRef(false);
    const onRefreshRef = useRef(onRefresh);

    useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);
    useEffect(() => { heightRef.current = height; }, [height]);
    useEffect(() => { refreshingRef.current = refreshing; }, [refreshing]);

    useEffect(() => {
        const isTouch =
            typeof window !== 'undefined' &&
            ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0);
        if (!isTouch) return;

        const isInsideOverlay = (target: EventTarget | null) => {
            if (!(target instanceof Element)) return false;
            return !!target.closest(
                '.bottom-sheet, .modal, .overlay, .settings-panel, [class*="modal"]'
            );
        };

        const onTouchStart = (e: TouchEvent) => {
            if (refreshingRef.current) return;
            if (window.scrollY > 0) return;
            if (isInsideOverlay(e.target)) return;
            if (e.touches.length !== 1) return;
            startYRef.current = e.touches[0].clientY;
            pullingRef.current = true;
        };

        const onTouchMove = (e: TouchEvent) => {
            if (!pullingRef.current) return;
            if (window.scrollY > 0) {
                pullingRef.current = false;
                setHeight(0);
                return;
            }
            const dy = e.touches[0].clientY - startYRef.current;
            if (dy <= 0) return;

            if (e.cancelable) e.preventDefault();
            const next = Math.min(dy * RESISTANCE, MAX_HEIGHT);
            setHeight(next);
        };

        const finishPull = async () => {
            if (!pullingRef.current) return;
            pullingRef.current = false;
            const reached = heightRef.current >= THRESHOLD;
            if (!reached) {
                setHeight(0);
                return;
            }
            setRefreshing(true);
            setHeight(MAX_HEIGHT);
            try {
                if (onRefreshRef.current) {
                    await onRefreshRef.current();
                } else {
                    window.dispatchEvent(new Event('storage'));
                    await new Promise((r) => setTimeout(r, 250));
                }
            } finally {
                setRefreshing(false);
                setHeight(0);
            }
        };

        const onTouchEnd = () => { void finishPull(); };
        const onTouchCancel = () => {
            if (!pullingRef.current) return;
            pullingRef.current = false;
            setHeight(0);
        };

        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('touchcancel', onTouchCancel, { passive: true });

        return () => {
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('touchcancel', onTouchCancel);
        };
    }, []);

    const visible = height > 0 || refreshing;

    return (
        <div
            id="ptr-indicator"
            className="ptr-indicator"
            style={{
                height: visible ? `${height}px` : undefined,
                display: visible ? 'flex' : undefined,
            }}
        >
            <div className="r-spinner">
                {[...Array(8)].map((_, i) => <div key={i} className="r-spinner-blade" />)}
            </div>
            <span className="ptr-actions">
                <div className={refreshing ? 'refreshing' : 'pulling'}>
                    {refreshing
                        ? <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M480-528 296-344l-56-56 240-240 240 240-56 56-184-184Z" /></svg>
                        : <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z" /></svg>
                    }
                </div>
            </span>
        </div>
    );
}
