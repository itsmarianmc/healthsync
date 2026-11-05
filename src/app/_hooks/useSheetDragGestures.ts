'use client';

import { useEffect, useRef, type RefObject } from 'react';

const INTERACTIVE = 'button, a, input, textarea, select, option, label, summary, [role="button"], [role="slider"], [role="spinbutton"], [contenteditable]:not([contenteditable="false"]), [data-sheet-no-drag]';
const DRAG_SLOP = 6;
const EDGE_PULL_SLOP = 32;
type Gesture = {
  input: 'touch' | 'pointer'; id: number; target: Element; body: boolean;
  x: number; y: number; active: boolean;
  native: boolean; pull: number;
};

export function useSheetDragGestures({ modalRef, overlayRef, onStart, onMove, onEnd, pointerHandle = false }: {
  modalRef: RefObject<HTMLDivElement | null>; overlayRef: RefObject<HTMLDivElement | null>;
  onStart: (y: number) => void; onMove: (y: number) => void; onEnd: (cancelled: boolean) => void;
  pointerHandle?: boolean;
}) {
  const gesture = useRef<Gesture | null>(null);

  // Rebind for mounted dialogs and current callbacks without resetting an active gesture.
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    modal.setAttribute('data-sheet-gestures', '');
    const enabled = () => {
      const overlay = overlayRef.current;
      if (!overlay?.classList.contains('visible') || overlay.inert || overlay.getAttribute('aria-hidden') === 'true') return false;
      const overlays = Array.from(document.querySelectorAll<HTMLElement>('.app-overlay.visible'));
      const top = overlays.reduce<HTMLElement | null>((current, candidate) => {
        const z = Number.parseInt(getComputedStyle(candidate).zIndex, 10) || 0;
        const currentZ = current ? Number.parseInt(getComputedStyle(current).zIndex, 10) || 0 : -Infinity;
        return z >= currentZ ? candidate : current;
      }, null);
      return top === overlay;
    };
    const finish = (cancelled: boolean) => {
      const current = gesture.current;
      gesture.current = null;
      if (!current) return;
      if (current.active) onEnd(cancelled || !enabled() || (current.body && current.pull <= EDGE_PULL_SLOP));
      if (current.input === 'pointer' && modal.hasPointerCapture(current.id)) modal.releasePointerCapture(current.id);
    };
    const start = (target: EventTarget | null, x: number, y: number, id: number, input: Gesture['input']) => {
      if (!enabled() || !(target instanceof Element) || target.closest('.modal') !== modal || target.closest(INTERACTIVE)) return;
      const header = target.closest('.modal-handle-zone, .modal-header');
      if (!header && !target.closest('.modal-body')) return;
      if (input === 'pointer' && !pointerHandle && target.closest('.modal-handle-zone')) return;
      gesture.current = { input, id, target, body: !header, x, y, active: false, native: false, pull: 0 };
    };
    const atScrollTop = (target: Element) => {
      for (let node: Element | null = target; node && node !== modal; node = node.parentElement) {
        // Include nested scrollers and negative iOS overscroll at the top edge.
        if (node.scrollTop > 1 || node.scrollTop < -1) return false;
      }
      return true;
    };
    const move = (event: Event, x: number, y: number) => {
      const current = gesture.current;
      if (!current) return;
      if (!enabled()) { finish(true); return; }
      if (current.body && window.getSelection()?.isCollapsed === false) { finish(true); return; }
      if (current.native) return;
      const dx = x - current.x, dy = y - current.y;
      if (!current.active) {
        if (Math.abs(dx) > DRAG_SLOP && Math.abs(dx) > Math.abs(dy)) { gesture.current = null; return; }
        if (current.body && (!atScrollTop(current.target) || dy <= 0)) {
          // WebKit moves may become non-cancelable; never steal an active native scroll.
          current.native = true;
          return;
        }
        if (Math.abs(dy) <= Math.abs(dx)) return;
        if (Math.abs(dy) < DRAG_SLOP) return;
        if (event.cancelable) event.preventDefault();
        else if (current.input === 'touch') { current.native = true; return; }
        current.active = true;
        onStart(current.y);
        if (current.input === 'pointer') {
          try { modal.setPointerCapture(current.id); } catch { /* The pointer may already have been cancelled. */ }
        }
      } else if (event.cancelable) event.preventDefault();
      current.pull = Math.max(0, dy);
      // Only fresh top-edge pulls use elasticity; short pulls cannot trigger fling dismissal.
      const pull = Math.max(0, dy);
      onMove(current.body ? current.y + (pull <= EDGE_PULL_SLOP ? pull / 3 : pull - EDGE_PULL_SLOP + EDGE_PULL_SLOP / 3) : y);
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return;
      // Mouse body drags remain available for text selection.
      if (event.pointerType === 'mouse' && event.target instanceof Element && !event.target.closest('.modal-header, .modal-handle-zone')) return;
      start(event.target, event.clientX, event.clientY, event.pointerId, 'pointer');
    };
    const pointerMove = (event: PointerEvent) => {
      if (gesture.current?.input !== 'pointer' || gesture.current.id !== event.pointerId) return;
      move(event, event.clientX, event.clientY);
    };
    const pointerUp = (event: PointerEvent) => {
      if (gesture.current?.input === 'pointer' && gesture.current.id === event.pointerId) finish(false);
    };
    const pointerCancel = (event: PointerEvent) => {
      if (gesture.current?.input === 'pointer' && gesture.current.id === event.pointerId) finish(true);
    };
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) { finish(true); return; }
      const touch = event.touches[0];
      start(event.target, touch.clientX, touch.clientY, touch.identifier, 'touch');
    };
    const touchMove = (event: TouchEvent) => {
      if (gesture.current?.input !== 'touch') return;
      if (event.touches.length !== 1) { finish(true); return; }
      const touch = event.touches[0];
      if (touch.identifier === gesture.current.id) move(event, touch.clientX, touch.clientY);
    };
    const touchEnd = () => { if (gesture.current?.input === 'touch') finish(false); };
    const touchCancel = () => { if (gesture.current?.input === 'touch') finish(true); };
    modal.addEventListener('pointerdown', pointerDown);
    document.addEventListener('pointermove', pointerMove);
    document.addEventListener('pointerup', pointerUp);
    document.addEventListener('pointercancel', pointerCancel);
    modal.addEventListener('lostpointercapture', pointerCancel);
    modal.addEventListener('touchstart', touchStart, { passive: true });
    modal.addEventListener('touchmove', touchMove, { passive: false });
    modal.addEventListener('touchend', touchEnd);
    modal.addEventListener('touchcancel', touchCancel);
    return () => {
      modal.removeEventListener('pointerdown', pointerDown);
      document.removeEventListener('pointermove', pointerMove);
      document.removeEventListener('pointerup', pointerUp);
      document.removeEventListener('pointercancel', pointerCancel);
      modal.removeEventListener('lostpointercapture', pointerCancel);
      modal.removeEventListener('touchstart', touchStart);
      modal.removeEventListener('touchmove', touchMove);
      modal.removeEventListener('touchend', touchEnd);
      modal.removeEventListener('touchcancel', touchCancel);
      modal.removeAttribute('data-sheet-gestures');
    };
  });
}
