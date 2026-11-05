'use client';

import { useLayoutEffect, useRef } from 'react';
import { getFocusableElements, isTopVisibleSheet, lockBodyScroll, registerSheet, releaseSheet, unlockBodyScroll, restoreDialogFocus } from '../_lib/dialogLayers';

/** Keep `open` true through exit so centered dialogs retain their blocking layer. */
export function useBlockingDialog(open: boolean, onDismiss: () => void) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const dismissRef = useRef(onDismiss);
    useLayoutEffect(() => { dismissRef.current = onDismiss; });
    useLayoutEffect(() => {
        const overlay = overlayRef.current, panel = panelRef.current;
        if (!open || !overlay || !panel) return;
        const previous = document.activeElement as HTMLElement | null;
        registerSheet(overlay); lockBodyScroll();
        const frame = requestAnimationFrame(() => {
            if (isTopVisibleSheet(overlay)) getFocusableElements(panel)[0]?.focus({ preventScroll: true });
        });
        const keydown = (event: KeyboardEvent) => {
            if (!isTopVisibleSheet(overlay)) return;
            if (event.key === 'Escape') { event.preventDefault(); dismissRef.current(); }
            if (event.key !== 'Tab') return;
            const elements = getFocusableElements(panel), first = elements[0], last = elements.at(-1);
            if (!first) { event.preventDefault(); return; }
            if (!panel.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) {
                event.preventDefault(); first.focus({ preventScroll: true });
            } else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus({ preventScroll: true }); }
        };
        document.addEventListener('keydown', keydown);
        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener('keydown', keydown);
            releaseSheet(overlay); unlockBodyScroll();
            if (previous?.isConnected) restoreDialogFocus(previous);
        };
    }, [open]);
    return { overlayRef, panelRef };
}
