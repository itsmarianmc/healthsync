'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { workspaceGuard } from '../../_lib/localData';

export default function FoodLibrarySheet({ id, title, onClose, children, dismiss = false, closePosition = 'right', onBack, backLabel = 'Back', backDisabled = false }: {
    id: string; title: string; onClose: () => void; children: ReactNode; dismiss?: boolean; closePosition?: 'left' | 'right';
    onBack?: () => void; backLabel?: string; backDisabled?: boolean;
}) {
    const finishClose = useCallback(() => {
        onClose();
        // Menu items are hidden again by the time a sheet closes.
        document.getElementById('extraActionToggle')?.focus();
    }, [onClose]);
    const { open, close, refreshHeight, modalRef, overlayRef, handleProps } = useDraggableSheet({ onClose: finishClose });
    const [isCurrent] = useState(() => workspaceGuard());
    useEffect(() => { open(); }, [open]);
    useEffect(() => { if (dismiss) close(); }, [dismiss, close]);
    useEffect(() => { refreshHeight(); }, [children, refreshHeight]);
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
    return <div className="app-overlay" id={`${id}Overlay`} ref={overlayRef}
        onClick={event => { if (event.target === event.currentTarget) close(); }}>
        <div className="modal food-library-modal" id={`${id}Modal`} ref={modalRef}
            role="dialog" aria-modal="true" aria-labelledby={`${id}Title`}>
            <div className="modal-handle-zone" {...handleProps}><div className="modal-handle" /></div>
            <div className="modal-header">
                {onBack && <div className="modal-btn">
                    <button type="button" className="back-btn" aria-label={backLabel} title={backLabel} disabled={backDisabled} onClick={onBack}>
                        <svg height="18" viewBox="0 -960 960 960" width="18" fill="currentColor" aria-hidden="true">
                            <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
                        </svg>
                    </button>
                </div>}
                <div className="modal-title" id={`${id}Title`}>{title}</div>
                <div className={closePosition === 'left' && !onBack ? 'modal-btn' : 'modal-btn--right'}>
                    <button type="button" className="back-btn" aria-label={`Close ${title}`} onClick={close}>
                        {closePosition === 'left' ? <svg height="18" viewBox="0 -960 960 960" width="18" fill="currentColor" aria-hidden="true">
                            <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                        </svg> : <i className="fa-solid fa-x"></i>}
                    </button>
                </div>
            </div>
            <div className="modal-body food-library-body">{children}</div>
        </div>
    </div>;
}
