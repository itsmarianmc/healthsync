'use client';

import { useRef, useCallback, useEffect, useLayoutEffect, useId } from 'react';
import { useSheetDragGestures } from './useSheetDragGestures';
import { useSheetViewport } from './useSheetViewport';
import { lockBodyScroll, unlockBodyScroll, registerSheet, releaseSheet, isTopVisibleSheet, getFocusableElements, restoreDialogFocus } from '../_lib/dialogLayers';

interface DraggableSheetConfig {
  onClose: () => void;
  onCloseStart?: () => void;
  getExpandedHeight?: () => number;
  getNaturalHeight?: (measuredHeight: number) => number;
  transitionDurationMs?: number;
  transitionEasing?: string;
  closeTransitionDurationMs?: number;
  closeTransitionEasing?: string;
  additionalTransitionProperties?: string[];
  expandable?: boolean;
  restoreFocus?: boolean;
  initialFocus?: string;
  initialExpanded?: boolean;
}

type SheetState = 'closed' | 'open' | 'expanded';
const SHEET_TOP_MARGIN = 24;
const EASE = 'cubic-bezier(0.34, 1.15, 0.64, 1)';

const CLOSE_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const FLING_CLOSE_VEL = 1500;

export function useDraggableSheet(config: DraggableSheetConfig) {
  // Stable callbacks must read the latest committed configuration.
  const titleId = useId();
  const configRef = useRef(config);
  useLayoutEffect(() => { configRef.current = config; });
  const expandable = config.expandable !== false;
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
  const lockedRef = useRef(false);
  const measurementFrame = useRef(0);
  const activeOverlayRef = useRef<HTMLElement | null>(null);
  const motionRef = useRef<Animation | null>(null);
  const heightMotionRef = useRef<Animation | null>(null);
  const motionFrame = useRef(0);
  const focusFrame = useRef(0);
  const completionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const pendingMeasurement = useRef(false);

  const cancelMotion = useCallback(() => {
    generation.current++;
    cancelAnimationFrame(motionFrame.current);
    cancelAnimationFrame(focusFrame.current);
    motionRef.current?.cancel();
    motionRef.current = null;
    heightMotionRef.current?.cancel();
    heightMotionRef.current = null;
    if (completionTimer.current) clearTimeout(completionTimer.current);
    completionTimer.current = null;
  }, []);

  // Keep transform motion independent of sizing; the timer covers lost animation completion.
  const animate = useCallback((from: string, to: string, closing: boolean, done: () => void) => {
    const el = modalRef.current;
    if (!el) return;
    cancelMotion();
    const token = generation.current;
    const opts = configRef.current;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 0 : closing ? opts.closeTransitionDurationMs ?? 360 : opts.transitionDurationMs ?? 420;
    const easing = closing ? opts.closeTransitionEasing ?? CLOSE_EASE : opts.transitionEasing ?? EASE;
    el.style.transition = ['scale', 'translate', ...(opts.additionalTransitionProperties || [])].map(property => `${property} ${duration}ms ${easing}`).join(', ');
    el.style.transform = to;
    let completed = false;
    const finish = () => {
      if (completed || generation.current !== token) return;
      completed = true;
      if (completionTimer.current) clearTimeout(completionTimer.current);
      completionTimer.current = null;
      motionRef.current?.cancel();
      motionRef.current = null;
      done();
    };
    if (!duration) { queueMicrotask(finish); return; }
    const motion = el.animate([{ transform: from }, { transform: to }], { duration, easing });
    motionRef.current = motion;
    void motion.finished.then(finish, () => {});
    completionTimer.current = setTimeout(finish, duration + 120);
  }, [cancelMotion]);

  const expandedHeight = useCallback(
    () => Math.min(configRef.current.getExpandedHeight?.() ?? Infinity, (window.visualViewport?.height ?? window.innerHeight) - SHEET_TOP_MARGIN),
    [],
  );

  const naturalHeight = useCallback(
    (measured: number) => Math.min(measured, configRef.current.getNaturalHeight?.(measured) ?? measured),
    [],
  );

  const setTransition = useCallback((props: string[]) => {
    if (!modalRef.current) return;
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : configRef.current.transitionDurationMs ?? 420;
    const easing = configRef.current.transitionEasing ?? EASE;
    modalRef.current.style.transition = [...props, ...(configRef.current.additionalTransitionProperties || [])]
      .map((p) => `${p} ${duration}ms ${easing}`)
      .join(', ');
  }, []);

  const snapToOpen = useCallback(() => {
    stateRef.current = 'open';
    if (isOpeningRef.current) { pendingMeasurement.current = true; return; }
    if (!modalRef.current) return;
    setTransition(['height', 'transform']);
    modalRef.current.style.height = naturalHeightRef.current + 'px';
    modalRef.current.style.transform = 'translateY(0)';
  }, [setTransition]);

  const snapToExpanded = useCallback(() => {
    if (!expandable) return;
    if (expandedHeight() <= naturalHeightRef.current + 1) { snapToOpen(); return; }
    stateRef.current = 'expanded';
    if (isOpeningRef.current) { pendingMeasurement.current = true; return; }
    if (!modalRef.current) return;
    setTransition(['height', 'transform']);
    modalRef.current.style.height = expandedHeight() + 'px';
    modalRef.current.style.transform = 'translateY(0)';
  }, [expandedHeight, setTransition, expandable, snapToOpen]);

  const measureContent = useCallback(() => {
    const el = modalRef.current;
    if (!el) return 0;
    const previous = el.style.height;
    const body = el.querySelector<HTMLElement>(':scope > .modal-body');
    const scrollTop = body?.scrollTop;
    el.style.height = 'auto';
    // Constrained flex bodies can hide intrinsic height in their scroll overflow.
    const content = el.offsetHeight + (body ? Math.max(0, body.scrollHeight - body.clientHeight) : 0);
    const max = Number.parseFloat(getComputedStyle(el).maxHeight);
    const height = Math.min(naturalHeight(content), Number.isFinite(max) ? max : expandedHeight());
    el.style.height = previous;
    if (body && scrollTop !== undefined) body.scrollTop = scrollTop;
    return height;
  }, [naturalHeight, expandedHeight]);

  const refreshHeight = useCallback((animateHeight = true) => {
    if (isOpeningRef.current) pendingMeasurement.current = true;
    if (
      !modalRef.current ||
      stateRef.current === 'closed' ||
      isDraggingRef.current ||
      isOpeningRef.current ||
      isClosingRef.current
    ) return;
    cancelAnimationFrame(measurementFrame.current);
    measurementFrame.current = requestAnimationFrame(() => {
        const el = modalRef.current;
        if (!el || stateRef.current === 'closed' || isDraggingRef.current || isOpeningRef.current || isClosingRef.current) return;
        const wasExpanded = stateRef.current === 'expanded';
        const renderedHeight = el.getBoundingClientRect().height / (parseFloat(getComputedStyle(el).scale) || 1);
        const previousHeightMotion = heightMotionRef.current;
        // Observer reports during resizing must preserve the original animation deadline.
        const previousTiming = previousHeightMotion?.effect?.getComputedTiming();
        const remaining = previousTiming && previousHeightMotion?.playState === 'running'
          ? Math.max(0, Number(previousTiming.duration) - Number(previousHeightMotion.currentTime || 0)) : undefined;
        previousHeightMotion?.cancel();
        heightMotionRef.current = null;
        // Measurement must preserve a covered parent's scale/translate animation.
        setTransition([]);
        const measured = measureContent();
        const target = wasExpanded ? expandedHeight() : measured;
        naturalHeightRef.current = measured;
        const stepping = el.querySelector('[data-content-changing="true"]');
        el.style.height = target + 'px';
        if (animateHeight && !wasExpanded && !stepping && Math.abs(renderedHeight - target) > 0.5 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const animation = el.animate([{ height: `${renderedHeight}px` }, { height: `${target}px` }], {
            duration: remaining ?? configRef.current.transitionDurationMs ?? 420,
            easing: configRef.current.transitionEasing ?? EASE,
          });
          heightMotionRef.current = animation;
          void animation.finished.then(() => { if (heightMotionRef.current === animation) heightMotionRef.current = null; }, () => {});
        }
    });
  }, [measureContent, expandedHeight, setTransition]);

  useLayoutEffect(() => {
    const modal = modalRef.current;
    if (modal && !modal.hasAttribute('tabindex')) modal.tabIndex = -1;
    if (modal && !modal.hasAttribute('role') && !overlayRef.current?.hasAttribute('role')) {
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      const title = modal.querySelector<HTMLElement>('.modal-title');
      if (title) {
        title.id ||= `sheet-title-${titleId}`;
        modal.setAttribute('aria-labelledby', title.id);
      }
    }
    if (stateRef.current === 'closed' && !isClosingRef.current && overlayRef.current) {
      overlayRef.current.inert = true;
      overlayRef.current.setAttribute('aria-hidden', 'true');
    }
  });

  const refreshViewportHeight = useCallback(() => refreshHeight(false), [refreshHeight]);
  useSheetViewport(overlayRef, refreshViewportHeight);

  useEffect(() => {
    const body = modalRef.current?.querySelector(':scope > .modal-body');
    if (!body) return;
    const resize = new ResizeObserver(() => refreshHeight());
    const observe = () => { resize.disconnect(); Array.from(body.children).forEach(child => resize.observe(child)); refreshHeight(); };
    const mutation = new MutationObserver(observe);
    mutation.observe(body, { childList: true, subtree: true, characterData: true });
    observe();
    return () => { resize.disconnect(); mutation.disconnect(); };
  });

  useEffect(() => () => {
    cancelMotion();
    releaseSheet(activeOverlayRef.current);
    cancelAnimationFrame(measurementFrame.current);
    isOpeningRef.current = false;
    isClosingRef.current = false;
    stateRef.current = 'closed';
    overlayRef.current?.classList.remove('visible');
    if (modalRef.current) modalRef.current.style.transform = 'translateY(110%)';
    if (lockedRef.current) { lockedRef.current = false; unlockBodyScroll(); }
  }, [cancelMotion]);

  const close = useCallback(() => {
    const el = modalRef.current;
    if (!el || isClosingRef.current || stateRef.current === 'closed') return;
    const from = getComputedStyle(el).transform;
    isOpeningRef.current = false;
    isClosingRef.current = true;
    stateRef.current = 'closed';
    configRef.current.onCloseStart?.();
    el.style.height = el.offsetHeight + 'px';
    overlayRef.current?.classList.remove('visible');
    overlayRef.current?.setAttribute('data-sheet-phase', 'closing');
    animate(from, 'translateY(110%)', true, () => {
      el.style.height = '';
      el.style.transition = 'none';
      naturalHeightRef.current = 0;
      isClosingRef.current = false;
      overlayRef.current?.setAttribute('data-sheet-phase', 'closed');
      releaseSheet(overlayRef.current);
      if (lockedRef.current) { lockedRef.current = false; unlockBodyScroll(); }
      const previous = previousFocusRef.current;
      const restore = configRef.current.restoreFocus !== false;
      previousFocusRef.current = null;
      configRef.current.onClose();
      if (restore && previous?.isConnected) restoreDialogFocus(previous);
    });
  }, [animate]);

  const startDrag = useCallback((clientY: number) => {
    if (!modalRef.current || isOpeningRef.current || isClosingRef.current || stateRef.current === 'closed') return;
    if (heightMotionRef.current) {
      modalRef.current.style.height = `${modalRef.current.offsetHeight}px`;
      heightMotionRef.current.cancel(); heightMotionRef.current = null;
    }
    isDraggingRef.current = true;
    dragStartYRef.current = clientY;
    dragLastYRef.current = clientY;
    dragDYRef.current = 0;
    velRef.current = 0;
    lastTimeRef.current = Date.now();
    modalRef.current.style.transition = 'none';
  }, []);

  const moveDrag = useCallback((clientY: number) => {
    if (!isDraggingRef.current || !modalRef.current) return;
    const dy = clientY - dragStartYRef.current;
    const now = Date.now();
    const dt = now - lastTimeRef.current;
    if (dt > 0)
      velRef.current = ((clientY - dragLastYRef.current) / dt) * 1000;
    dragLastYRef.current = clientY;
    dragDYRef.current = dy;
    lastTimeRef.current = now;

    if (stateRef.current === 'expanded') {
      const baseH = expandedHeight();
      const newH = Math.max(naturalHeightRef.current, baseH - Math.max(dy, 0));
      if (dy > 0) modalRef.current.style.height = newH + 'px';
    } else {
      if (dy > 0) {
        modalRef.current.style.transform = `translateY(${dy}px)`;
      } else if (expandable) {
        const baseH = naturalHeightRef.current;
        const newH = Math.min(expandedHeight(), baseH + Math.abs(dy));
        modalRef.current.style.height = newH + 'px';
        modalRef.current.style.transform = 'translateY(0)';
      }
    }
  }, [expandedHeight, expandable]);

  const finishDrag = useCallback((cancelled = false) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (stateRef.current === 'closed') { dragDYRef.current = 0; velRef.current = 0; return; }
    const dy = dragDYRef.current;
    const vel = Date.now() - lastTimeRef.current > 100 ? 0 : velRef.current;

    if (cancelled) {
      if (stateRef.current === 'expanded') snapToExpanded();
      else if (stateRef.current === 'open') snapToOpen();
    } else if (vel > FLING_CLOSE_VEL && dy > 12 && stateRef.current !== 'expanded') {
      close();
    } else if (dy > 80 || (vel > 400 && dy > 12)) {
      if (stateRef.current === 'expanded') {
        snapToOpen();
      } else {
        close();
      }
    } else if (expandable && (dy < -60 || (vel < -400 && dy < -12))) {
      snapToExpanded();
    } else {
      if (stateRef.current === 'expanded') snapToExpanded();
      else snapToOpen();
    }
    dragDYRef.current = 0;
    velRef.current = 0;
  }, [close, snapToExpanded, snapToOpen, expandable]);

  useSheetDragGestures({ modalRef, overlayRef, onStart: startDrag, onMove: moveDrag, onEnd: finishDrag });

  const onHandlePointerDown = useCallback((event: React.PointerEvent) => {
    if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0 || !isTopVisibleSheet(overlayRef.current)) return;
    startDrag(event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [startDrag]);
  const onHandlePointerMove = useCallback((event: React.PointerEvent) => {
    if (event.pointerType !== 'touch') moveDrag(event.clientY);
  }, [moveDrag]);
  const onHandlePointerUp = useCallback((event: React.PointerEvent) => {
    if (event.pointerType !== 'touch') finishDrag();
  }, [finishDrag]);
  const onHandlePointerCancel = useCallback((event: React.PointerEvent) => {
    if (event.pointerType !== 'touch') finishDrag(true);
  }, [finishDrag]);

  const open = useCallback(() => {
    const el = modalRef.current;
    if (!el || isOpeningRef.current || stateRef.current !== 'closed') return;
    const interrupted = isClosingRef.current;
    const from = interrupted ? getComputedStyle(el).transform : 'translateY(100%)';
    cancelMotion();
    isClosingRef.current = false;
    isOpeningRef.current = true;
    stateRef.current = 'open';
    if (!interrupted) previousFocusRef.current = document.activeElement as HTMLElement;
    el.style.transition = 'none';
    el.style.height = 'auto';
    el.style.transform = from;
    if (overlayRef.current) {
      activeOverlayRef.current = overlayRef.current;
      registerSheet(overlayRef.current);
      overlayRef.current.classList.add('visible');
    }
    overlayRef.current?.setAttribute('data-sheet-phase', 'opening');
    if (!lockedRef.current) { lockBodyScroll(); lockedRef.current = true; }
    const token = generation.current;
    // Commit mounted nodes and their final height before entrance motion.
    motionFrame.current = requestAnimationFrame(() => {
      motionFrame.current = requestAnimationFrame(() => {
        if (generation.current !== token || !modalRef.current) return;
        naturalHeightRef.current = measureContent();
        let preferExpanded = configRef.current.initialExpanded === true;
        try { preferExpanded ||= localStorage.getItem('healthsync_modals_expanded') === 'true'; } catch {}
        if (configRef.current.expandable !== false && preferExpanded && expandedHeight() > naturalHeightRef.current + 1) stateRef.current = 'expanded';
        el.style.height = (stateRef.current === 'expanded' ? expandedHeight() : naturalHeightRef.current) + 'px';
        animate(from, 'translateY(0)', false, () => {
          isOpeningRef.current = false;
          setTransition(['transform']);
          overlayRef.current?.setAttribute('data-sheet-phase', 'open');
          focusFrame.current = requestAnimationFrame(() => {
            const focus = (configRef.current.initialFocus
              ? el.querySelector<HTMLElement>(configRef.current.initialFocus)
              : getFocusableElements(el)[0]) ?? el;
            if (isTopVisibleSheet(overlayRef.current)) focus.focus({ preventScroll: true });
          });

          if (pendingMeasurement.current) { pendingMeasurement.current = false; refreshHeight(); }
        });
      });
    });
  }, [animate, cancelMotion, measureContent, expandedHeight, refreshHeight, setTransition]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stateRef.current !== 'closed' && isTopVisibleSheet(overlayRef.current)) {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [close]);

  useEffect(() => {
    const containFocus = (event: FocusEvent) => {
      const modal = modalRef.current;
      if (!modal || (stateRef.current === 'closed' && !isClosingRef.current) || !isTopVisibleSheet(overlayRef.current) || modal.contains(event.target as Node)) return;
      const target = getFocusableElements(modal)[0] ?? modal;
      target.focus({ preventScroll: true });
    };
    document.addEventListener('focusin', containFocus);
    return () => document.removeEventListener('focusin', containFocus);
  }, []);

  useEffect(() => {
    const handleTabTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || (stateRef.current === 'closed' && !isClosingRef.current) || !modalRef.current || !isTopVisibleSheet(overlayRef.current)) return;
      const focusable = getFocusableElements(modalRef.current);
      if (focusable.length === 0) { e.preventDefault(); modalRef.current.focus({ preventScroll: true }); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!modalRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus({ preventScroll: true }); }
      else if (e.shiftKey && document.activeElement === first) {
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

  const setModalRef = useCallback((node: HTMLDivElement | null) => { modalRef.current = node; }, []);
  const setOverlayRef = useCallback((node: HTMLDivElement | null) => { overlayRef.current = node; }, []);
  return {
    modalRef,
    overlayRef,
    setModalRef,
    setOverlayRef,
    open,
    close,
    refreshHeight,
    snapToExpanded,
    handleProps: {
      onPointerDown: onHandlePointerDown,
      onPointerMove: onHandlePointerMove,
      onPointerUp: onHandlePointerUp,
      onPointerCancel: onHandlePointerCancel,
      onLostPointerCapture: onHandlePointerCancel,
    },
    stateRef,
  };
}
