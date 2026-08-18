'use client';

import { useEffect } from 'react';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';

export type AiMethod = 'describe' | 'import' | 'capture';

interface AiMethodModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (mode: AiMethod) => void;
    isAiDetectionUsable?: boolean;
}

export default function AiMethodModal({ isOpen, onClose, onSelect, isAiDetectionUsable = true }: AiMethodModalProps) {
    const sheet = useDraggableSheet({ onClose });

    useEffect(() => {
        if (isOpen) sheet.open();
        else if (sheet.stateRef.current !== 'closed') sheet.close();
    }, [isOpen]);

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
                    {!isAiDetectionUsable && (
                        <div style={{ textAlign: 'center', opacity: 0.6, padding: '8px 0 16px', fontSize: '0.9em' }}>
                            Enable AI in Settings and add a Gemini API key to use this feature.
                        </div>
                    )}
                    <div className="ai-method-grid">
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
