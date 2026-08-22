'use client';

import { useRef, useCallback, useEffect } from 'react';

interface DraggableSheetConfig {
  onClose: () => void;
  getExpandedHeight?: () => number;
  transitionDurationMs?: number;
  transitionEasing?: string;
  closeTransitionDurationMs?: number;
  closeTransitionEasing?: string;
}

type SheetState = 'closed' | 'open' | 'expanded';
const SHEET_TOP_MARGIN = 24;
const EASE = 'cubic-bezier(0.34, 1.15, 0.64, 1)';

const CLOSE_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const FLING_CLOSE_VEL = 1500;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let bodyLockCount = 0;

function lockBodyScroll() {
  if (bodyLockCount === 0) document.body.classList.add('modal-open');
  bodyLockCount += 1;
}

function unlockBodyScroll() {
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  if (bodyLockCount === 0) document.body.classList.remove('modal-open');
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
}

export function useDraggableSheet(config: DraggableSheetConfig) {
  const {
    onClose,
    getExpandedHeight,
    transitionDurationMs,
    transitionEasing,
    closeTransitionDurationMs,
    closeTransitionEasing,
  } = config;
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
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const expandedHeight = useCallback(
    () => getExpandedHeight?.() ?? window.innerHeight - SHEET_TOP_MARGIN,
    [getExpandedHeight],
  );

  const setTransition = useCallback((props: string[]) => {
    if (!modalRef.current) return;
    const duration = transitionDurationMs ?? 420;
    const easing = transitionEasing ?? EASE;
    modalRef.current.style.transition = props
      .map((p) => `${p} ${duration}ms ${easing}`)
      .join(', ');
  }, [transitionDurationMs, transitionEasing]);

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
  }, [expandedHeight, setTransition]);

  const refreshHeight = useCallback(() => {
    if (
      !modalRef.current ||
      stateRef.current === 'closed' ||
      isDraggingRef.current ||
      isOpeningRef.current ||
      isClosingRef.current
    ) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = modalRef.current;
        if (!el || stateRef.current === 'closed' || isDraggingRef.current || isOpeningRef.current || isClosingRef.current) return;
        if (stateRef.current === 'expanded') return;
        const prevHeight = el.style.height;
        const prevTransition = el.style.transition;
        el.style.transition = 'none';
        el.style.height = 'auto';
        const measured = el.offsetHeight;
        el.style.height = prevHeight;
        void el.offsetHeight;
        el.style.transition = prevTransition;
        if (measured === naturalHeightRef.current) return;
        naturalHeightRef.current = measured;
        setTransition(['height', 'transform']);
        el.style.height = measured + 'px';
      });
    });
  }, [setTransition]);

  const close = useCallback(() => {
    if (!modalRef.current || isClosingRef.current) return;
    isClosingRef.current = true;
    stateRef.current = 'closed';
    const curH = modalRef.current.offsetHeight;
    modalRef.current.style.transition = 'none';
    modalRef.current.style.height = curH + 'px';
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!modalRef.current) return;
        modalRef.current.style.transition = `transform ${closeTransitionDurationMs ?? 360}ms ${closeTransitionEasing ?? CLOSE_EASE}`;
        modalRef.current.style.transform = 'translateY(110%)';
        unlockBodyScroll();
      }),
    );
    if (overlayRef.current) overlayRef.current.classList.remove('visible');
    setTimeout(() => {
      if (modalRef.current) {
        modalRef.current.style.height = '';
        modalRef.current.style.transition = '';
        naturalHeightRef.current = 0;
      }
      isClosingRef.current = false;
      if (previousFocusRef.current && previousFocusRef.current.isConnected) {
        previousFocusRef.current.focus();
      }
      previousFocusRef.current = null;
      onClose();
    }, 400);
  }, [closeTransitionDurationMs, closeTransitionEasing, onClose]);

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
    if (dt > 0)
      velRef.current = ((e.clientY - dragLastYRef.current) / dt) * 1000;
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
  }, [expandedHeight]);

  const onHandlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const dy = dragDYRef.current;
    const vel = velRef.current;

    if (vel > FLING_CLOSE_VEL && dy > 0) {
      close();
    } else if (dy > 80 || vel > 400) {
      if (stateRef.current === 'expanded') {
        snapToOpen();
      } else {
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
    if (
      !modalRef.current ||
      isOpeningRef.current ||
      stateRef.current !== 'closed'
    )
      return;
    isOpeningRef.current = true;
    stateRef.current = 'open';
    previousFocusRef.current = document.activeElement as HTMLElement;
    modalRef.current.style.transition = 'none';
    modalRef.current.style.height = 'auto';
    modalRef.current.style.transform = 'translateY(100%)';
    if (overlayRef.current) overlayRef.current.classList.add('visible');
    lockBodyScroll();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!modalRef.current) return;
        naturalHeightRef.current = modalRef.current.offsetHeight;
        const preferExpanded = (() => {
          try {
            return (
              localStorage.getItem('healthsync_modals_expanded') === 'true'
            );
          } catch {
            return false;
          }
        })();
        if (preferExpanded) {
          setTransition(['height', 'transform']);
          modalRef.current.style.height = expandedHeight() + 'px';
          modalRef.current.style.transform = 'translateY(0)';
          stateRef.current = 'expanded';
        } else {
          setTransition(['transform']);
          modalRef.current.style.transform = 'translateY(0)';
          modalRef.current.style.height = naturalHeightRef.current + 'px';
        }
        isOpeningRef.current = false;
        const firstFocusable = modalRef.current?.querySelector<HTMLElement>(FOCUSABLE);
        if (firstFocusable) firstFocusable.focus();
      }),
    );
  }, [expandedHeight, setTransition]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stateRef.current !== 'closed') {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [close]);

  useEffect(() => {
    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || stateRef.current === 'closed' || !modalRef.current) return;
      const focusable = getFocusableElements(modalRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleTabTrap);
    return () => document.removeEventListener('keydown', handleTabTrap);
  }, []);

  return {
    modalRef,
    overlayRef,
    setModalRef: (node: HTMLDivElement | null) => {
      modalRef.current = node;
    },
    setOverlayRef: (node: HTMLDivElement | null) => {
      overlayRef.current = node;
    },
    open,
    close,
    refreshHeight,
    snapToExpanded,
    handleProps: {
      onPointerDown: onHandlePointerDown,
      onPointerMove: onHandlePointerMove,
      onPointerUp: onHandlePointerUp,
    },
    stateRef,
  };
}
