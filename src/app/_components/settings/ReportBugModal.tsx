'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../_context/AuthContext';
import { APP_VERSION } from '../../_lib/release';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';

interface ReportBugModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ReportBugModal({ isOpen, onClose }: ReportBugModalProps) {
    const { user } = useAuth();
    const pathname = usePathname();
    const [src, setSrc] = useState('');
    const sheet = useDraggableSheet({ onClose });

    useEffect(() => {
        if (!isOpen) return;
        const params = new URLSearchParams({
            cnt_src: 'healthsync',
            user_id: user?.id ?? '',
            app_version: APP_VERSION,
            ref: pathname || '/',
            hide_header: '1',
            hide_footer: '1',
        });
        setSrc(`https://itsmarian.dev/report?${params.toString()}`);
    }, [isOpen, user?.id, pathname]);

    useEffect(() => {
        if (isOpen) {
            sheet.open();
            const t = setTimeout(() => {
                if (sheet.stateRef.current !== 'closed') sheet.snapToExpanded();
            }, 80);
            return () => window.clearTimeout(t);
        } else if (sheet.stateRef.current !== 'closed') {
            sheet.close();
        }
    }, [isOpen]);

    return (
        <div className="app-overlay report-bug-overlay" id="reportBugOverlay" ref={sheet.overlayRef} onClick={e => { if (e.target === sheet.overlayRef.current) sheet.close(); }}>
            <div className="modal report-bug-modal" id="reportBugModal" ref={sheet.modalRef} role="dialog" aria-modal="true" aria-labelledby="reportBugTitle">
                <div className="modal-handle-zone" id="reportBugHandleZone" {...sheet.handleProps}>
                    <div className="modal-handle" />
                </div>
                <div className="modal-header">
                    <div className="modal-title" id="reportBugTitle">Report a Bug</div>
                </div>
                <div className="modal-body report-bug-body" id="reportBugModalBody">
                    {isOpen && src && (
                        <iframe title="Report a Bug" src={src} className="report-bug-iframe" />
                    )}
                </div>
            </div>
        </div>
    );
}