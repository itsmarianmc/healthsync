'use client';

import { useRef, useState, useCallback } from 'react';

interface PullToRefreshProps {
    onRefresh?: () => Promise<void>;
}

const THRESHOLD = 50;
const MAX_HEIGHT = 60;

export default function PullToRefresh({ onRefresh }: PullToRefreshProps) {
    const [height, setHeight] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const startYRef = useRef(0);
    const pullingRef = useRef(false);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (window.scrollY !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest('.bottom-sheet, .modal, .overlay, [class*="modal"]')) return;
        startYRef.current = e.touches[0].clientY;
        pullingRef.current = true;
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!pullingRef.current || window.scrollY !== 0) return;
        const dy = e.touches[0].clientY - startYRef.current;
        if (dy < 0) {
            pullingRef.current = false;
            return;
        }
        setHeight(Math.min(dy * 0.5, MAX_HEIGHT));
    }, []);

    const handleTouchEnd = useCallback(async () => {
        if (!pullingRef.current) return;
        pullingRef.current = false;
        if (height >= THRESHOLD) {
            setRefreshing(true);
            setHeight(MAX_HEIGHT);
            if (onRefresh) await onRefresh();
            else window.dispatchEvent(new Event('storage'));
            setRefreshing(false);
        }
        setHeight(0);
    }, [height, onRefresh]);

    return (
        <>
            <div
                id="ptr-indicator"
                className="ptr-indicator"
                style={{ height: height > 0 ? height + 'px' : undefined, display: height > 0 ? 'flex' : undefined }}
                >
                <div className="r-spinner">
                    {[...Array(8)].map((_, i) => <div key={i} className="r-spinner-blade" />)}
                </div>
                <span className="ptr-actions">
                    <div className={refreshing ? 'refreshing' : 'pulling'}>
                        {refreshing
                        ? <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M480-528 296-344l-56-56 240-240 240 240-56 56-184-184Z"/></svg>
                        : <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3"><path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z"/></svg>
                        }
                    </div>
                </span>
            </div>
            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '100px', zIndex: -1, pointerEvents: 'none' }}
            />
        </>
    );
}
