'use client';

import { useEffect, useRef } from 'react';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { useAppShell } from '../../_context/AppShellContext';

export type AiMethod = 'describe' | 'import' | 'capture';

interface AiMethodModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (mode: AiMethod) => void;
    isAiDetectionUsable?: boolean;
    onOpenSettings?: () => void;
}

export default function AiMethodModal({ isOpen, onClose, onSelect, isAiDetectionUsable = true, onOpenSettings }: AiMethodModalProps) {
    const pendingOpenSettings = useRef(false);
    const sheet = useDraggableSheet({
        onClose: () => {
            if (pendingOpenSettings.current) {
                pendingOpenSettings.current = false;
                onClose();
                onOpenSettings?.();
            } else {
                onClose();
            }
        },
    });
    const { closeSettings } = useAppShell();
    const wasOpen = useRef(false);

    useEffect(() => {
        if (isOpen) {
            if (!wasOpen.current) closeSettings();
            wasOpen.current = true;
            sheet.open();
        }
        else {
            wasOpen.current = false;
            if (sheet.stateRef.current !== 'closed') sheet.close();
        }
    }, [isOpen, closeSettings]);

    const pick = (mode: AiMethod) => {
        if (!isAiDetectionUsable) return;
        sheet.close();
        onSelect(mode);
    };

    return (
        <div
            className={`app-overlay${isOpen ? ' visible' : ''}`}
            id="aiMethodOverlay"
            ref={sheet.overlayRef}
            onClick={e => { if (e.target === sheet.overlayRef.current) sheet.close(); }}
        >
            <div
                className="modal"
                id="aiMethodModal"
                ref={sheet.modalRef}
                style={{ transform: 'translateY(100%)', transition: 'transform 0.42s cubic-bezier(0.34, 1.15, 0.64, 1)' }}
            >
                <div className="modal-handle-zone" id="aiMethodHandleZone" {...sheet.handleProps}>
                    <div className="modal-handle" />
                </div>
                <div className="modal-header">
                    <div className="modal-title">AI Detection</div>
                </div>
                <div className="modal-body" id="aiMethodModalBody">
                    <div className="ai-method-grid">
                        {!isAiDetectionUsable && (
                            <div className="ai-method-disabled-note" id="aiMethodDisabledNote">
                                <div className="ai-method-disabled-text">
                                    <i className="fa-solid fa-triangle-exclamation" />
                                    <div>
                                        <strong>AI Detection is disabled</strong>
                                        <span>Enable it in Settings and add your Gemini API key to use photo, camera and text detection.</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="ai-method-settings-link"
                                    id="aiMethodOpenSettingsBtn"
                                    onClick={() => {
                                        pendingOpenSettings.current = true;
                                        sheet.close();
                                    }}
                                >
                                    <i className="fa-solid fa-gear" />Open Settings
                                </button>
                            </div>
                        )}
                        <div
                            className={`ai-method-card${isAiDetectionUsable ? '' : ' disabled'}`}
                            id="aiMethodSelectImage"
                            aria-disabled={!isAiDetectionUsable}
                            onClick={() => pick('import')}
                        >
                            <div className="ai-method-icon"><i className="fa-solid fa-image" /></div>
                            <div className="ai-method-label">Select Image</div>
                        </div>
                        <div
                            className={`ai-method-card${isAiDetectionUsable ? '' : ' disabled'}`}
                            id="aiMethodTakePicture"
                            aria-disabled={!isAiDetectionUsable}
                            onClick={() => pick('capture')}
                        >
                            <div className="ai-method-icon"><i className="fa-solid fa-camera" /></div>
                            <div className="ai-method-label">Take Picture</div>
                        </div>
                        <div
                            className={`ai-method-card${isAiDetectionUsable ? '' : ' disabled'}`}
                            id="aiMethodDescribeText"
                            aria-disabled={!isAiDetectionUsable}
                            onClick={() => pick('describe')}
                        >
                            <div className="ai-method-icon"><i className="fa-solid fa-pen" /></div>
                            <div className="ai-method-label">Describe Text</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
