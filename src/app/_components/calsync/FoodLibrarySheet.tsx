'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { workspaceGuard } from '../../_lib/localData';

const SCALE_TRANSITION = ['scale'];
const SHEET_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

export default function FoodLibrarySheet({ id, title, onClose, children, footer, dismiss = false, onBack, backLabel = 'Back', backDisabled = false, bodyClassName = '', covered = false, nested = false, compact = false, returnFocusTo, restoreFocus = true, initialFocus }: {
    id: string; title: string; onClose: () => void; children: ReactNode; dismiss?: boolean;
    onBack?: () => void; backLabel?: string; backDisabled?: boolean; bodyClassName?: string;
    covered?: boolean; nested?: boolean;
    returnFocusTo?: HTMLElement | null;
    footer?: ReactNode;
    compact?: boolean;
    restoreFocus?: boolean; initialFocus?: string;
}) {
    const finishClose = useCallback(() => {
        onClose();
        // Menu items are hidden again by the time a sheet closes.
        if (!nested) document.getElementById('extraActionToggle')?.focus();
    }, [onClose, nested]);
    const { open, close, modalRef, overlayRef, handleProps } = useDraggableSheet({
        onClose: finishClose, transitionDurationMs: 350, transitionEasing: SHEET_EASING,
        closeTransitionDurationMs: 350, closeTransitionEasing: SHEET_EASING,
        additionalTransitionProperties: SCALE_TRANSITION, expandable: !compact,
        restoreFocus, initialFocus,
    });
    const [isCurrent] = useState(() => workspaceGuard());
    useEffect(() => { open(); }, [open]);
    useEffect(() => { if (dismiss) close(); }, [dismiss, close]);
    useEffect(() => {
        // Toggle modifiers imperatively so React cannot replace the hook's `visible` class.
        const overlay = overlayRef.current;
        if (!overlay) return;
        if (!covered) { overlay.classList.remove('has-sub-modal'); return; }
        // Restore scale on child exit, but keep the parent inert until child unmount.
        const update = () => {
            const childVisible = Array.from(document.querySelectorAll('.food-library-overlay.visible'))
                .some(child => !!(overlay.compareDocumentPosition(child) & Node.DOCUMENT_POSITION_FOLLOWING));
            overlay.classList.toggle('has-sub-modal', childVisible);
        };
        update();
        const observer = new MutationObserver(update);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
        return () => observer.disconnect();
    }, [covered, overlayRef]);
    useEffect(() => {
        if (!covered && returnFocusTo?.isConnected) returnFocusTo.focus({ preventScroll: true });
    }, [covered, returnFocusTo]);
    useEffect(() => {
        const check = () => {
            if (isCurrent()) return;
            // Hide the old owner's contents immediately, before the closing animation.
            if (modalRef.current) modalRef.current.style.visibility = 'hidden';
            close();
        };
        window.addEventListener('storage', check);
        return () => window.removeEventListener('storage', check);
    }, [close, isCurrent, modalRef]);
    return <div className={`app-overlay food-library-overlay${nested ? ' food-library-nested-overlay food-library-edit-overlay' : ''}`} id={`${id}Overlay`} ref={overlayRef} inert={covered} aria-hidden={covered || undefined}
        onClick={event => { if (event.target === event.currentTarget) close(); }}>
        <div className={`modal food-library-modal${compact ? ' food-library-modal--compact' : ''}${covered ? ' food-library-modal--has-submodal' : ''}`} id={`${id}Modal`} ref={modalRef}
            role="dialog" aria-modal="true" aria-labelledby={`${id}Title`}>
            <div className="modal-handle-zone" {...handleProps}><div className="modal-handle" /></div>
            <div className="modal-header">
                {onBack && <div className="modal-btn">
                    <button type="button" className="back-btn" aria-label={backLabel} title={backLabel} disabled={backDisabled} onClick={onBack}>
                        <i className="fa-solid fa-arrow-left" aria-hidden="true" />
                    </button>
                </div>}
                <h2 className="modal-title" id={`${id}Title`}>{title}</h2>
                {!onBack && <div className="modal-btn--right">
                    <button type="button" className="back-btn" aria-label={`Close ${title}`} onClick={close}>
                        <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                    </button>
                </div>}
            </div>
            <div className={`modal-body food-library-body ${bodyClassName}`}>{children}</div>
            {footer}
        </div>
    </div>;
}
