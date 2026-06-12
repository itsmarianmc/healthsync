'use client';

import { useRef, useCallback } from 'react';

interface DraggableSheetConfig {
  onClose: () => void;
  getExpandedHeight?: () => number;
}

type SheetState = 'closed' | 'open' | 'expanded';
const SHEET_TOP_MARGIN = 24;
const EASE = 'cubic-bezier(0.34, 1.15, 0.64, 1)';

export function useDraggableSheet(config: DraggableSheetConfig) {
    const modalRef = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const stateRef = useRef<SheetState>('closed');
    const naturalHeightRef = useRef(0);
    const dragStartYRef = useRef(0);
    const dragLastYRef = useRef(0);
    const dragDYRef = useRef(0);
    const velRef = useRef(0);
    const isDraggingRef = useRef(false);
    const lastTimeRef = useRef(0);
    const isClosingRef = useRef(false);
    const isOpeningRef = useRef(false);

    const expandedHeight = () => config.getExpandedHeight?.() ?? (window.innerHeight - SHEET_TOP_MARGIN);

    const setTransition = useCallback((props: string[]) => {
        if (!modalRef.current) return;
        modalRef.current.style.transition = props.map(p => `${p} 0.42s ${EASE}`).join(', ');
    }, []);

    const snapToOpen = useCallback(() => {
        stateRef.current = 'open';
        if (!modalRef.current) return;
        setTransition(['height', 'transform']);
        modalRef.current.style.height = naturalHeightRef.current + 'px';
        modalRef.current.style.transform = 'translateY(0)';
    }, [setTransition]);

    const snapToExpanded = useCallback(() => {
        stateRef.current = 'expanded';
        if (!modalRef.current) return;
        setTransition(['height', 'transform']);
        modalRef.current.style.height = expandedHeight() + 'px';
        modalRef.current.style.transform = 'translateY(0)';
    }, [setTransition]);

    const close = useCallback(() => {
        if (!modalRef.current || isClosingRef.current) return;
        isClosingRef.current = true;
        stateRef.current = 'closed';
        const curH = modalRef.current.offsetHeight;
        modalRef.current.style.transition = 'none';
        modalRef.current.style.height = curH + 'px';
        requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!modalRef.current) return;
        modalRef.current.style.transition = `transform 0.36s cubic-bezier(0.4, 0, 0.2, 1)`;
        modalRef.current.style.transform = 'translateY(110%)';
        document.body.classList.remove('modal-open');
        }));
        if (overlayRef.current) overlayRef.current.classList.remove('visible');
        setTimeout(() => {
        if (modalRef.current) {
            modalRef.current.style.height = '';
            modalRef.current.style.transition = '';
            naturalHeightRef.current = 0;
        }
        isClosingRef.current = false;
        config.onClose();
        }, 400);
    }, [config]);

    const onHandlePointerDown = useCallback((e: React.PointerEvent) => {
        if (!modalRef.current) return;
        isDraggingRef.current = true;
        dragStartYRef.current = e.clientY;
        dragLastYRef.current = e.clientY;
        velRef.current = 0;
        lastTimeRef.current = Date.now();
        modalRef.current.style.transition = 'none';
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, []);

    const onHandlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDraggingRef.current || !modalRef.current) return;
        const dy = e.clientY - dragStartYRef.current;
        const now = Date.now();
        const dt = now - lastTimeRef.current;
        if (dt > 0) velRef.current = (e.clientY - dragLastYRef.current) / dt * 1000;
        dragLastYRef.current = e.clientY;
        dragDYRef.current = dy;
        lastTimeRef.current = now;

        if (stateRef.current === 'expanded') {
        const baseH = expandedHeight();
        const newH = Math.max(naturalHeightRef.current, baseH - Math.max(dy, 0));
        if (dy > 0) modalRef.current.style.height = newH + 'px';
        } else {
        if (dy > 0) {
            modalRef.current.style.transform = `translateY(${dy}px)`;
        } else {
            const baseH = naturalHeightRef.current;
            const newH = Math.min(expandedHeight(), baseH + Math.abs(dy));
            modalRef.current.style.height = newH + 'px';
            modalRef.current.style.transform = 'translateY(0)';
        }
        }
    }, []);

    const onHandlePointerUp = useCallback(() => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;
        const dy = dragDYRef.current;
        const vel = velRef.current;

        if (dy > 80 || vel > 400) {
            if (stateRef.current === 'expanded') {
                snapToOpen();
            }
            else {
                close();
            }
        } else if (dy < -60 || vel < -400) {
            snapToExpanded();
        } else {
            if (stateRef.current === 'expanded') snapToExpanded();
            else snapToOpen();
        }
        dragDYRef.current = 0;
        velRef.current = 0;
    }, [close, snapToExpanded, snapToOpen]);

    const open = useCallback(() => {
        if (!modalRef.current || isOpeningRef.current || stateRef.current !== 'closed') return;
        isOpeningRef.current = true;
        stateRef.current = 'open';
        modalRef.current.style.transition = 'none';
        modalRef.current.style.height = 'auto';
        modalRef.current.style.transform = 'translateY(100%)';
        if (overlayRef.current) overlayRef.current.classList.add('visible');
        document.body.classList.add('modal-open');
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (!modalRef.current) return;
            naturalHeightRef.current = modalRef.current.offsetHeight;
            setTransition(['transform']);
            modalRef.current.style.transform = 'translateY(18px)';
            modalRef.current.style.height = naturalHeightRef.current + 'px';
            isOpeningRef.current = false;
        }));
    }, [setTransition]);

    return {
        modalRef, overlayRef, open, close, snapToExpanded,
        handleProps: {
            onPointerDown: onHandlePointerDown,
            onPointerMove: onHandlePointerMove,
            onPointerUp: onHandlePointerUp,
        },
        stateRef,
    };
}

