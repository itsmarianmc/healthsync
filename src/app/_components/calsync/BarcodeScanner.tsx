'use client';

import { useState, useRef, useEffect } from 'react';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { resolveBackCameraConstraints, upgradeToPreferredBackCamera } from '../../_lib/camera';

interface BarcodeScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onScanned: (barcode: string) => void;
    embedded?: boolean;
}

export default function BarcodeScanner({ isOpen, onClose, onScanned, embedded }: BarcodeScannerProps) {
    const sheet = useDraggableSheet({ onClose });
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Looking for barcode...');
    const streamRef = useRef<MediaStream | null>(null);
    const readerRef = useRef<unknown>(null);
    const activeRef = useRef(false);
    const cameraIndexRef = useRef(0);
    const deviceIdRef = useRef<string | undefined>(undefined);

    const stopCamera = () => {
        activeRef.current = false;
        if (readerRef.current) {
            try { (readerRef.current as { reset: () => void }).reset(); } catch {}
            readerRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
    };

    const startCamera = async (deviceId?: string) => {
        const ZXing = (window as unknown as Record<string, unknown>)['ZXingBrowser'] as {
            BrowserMultiFormatReader: new () => {
                decodeFromStream: (
                    stream: MediaStream,
                    video: HTMLVideoElement,
                    cb: (result: { getText: () => string } | null, err: Error | null) => void
                ) => void;
                reset: () => void;
            };
        };
        if (!ZXing) { setStatus('Barcode library not loaded.'); return; }
            const constraints: MediaStreamConstraints = await resolveBackCameraConstraints(deviceId);
        try {
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            let stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (!deviceId) {
                stream = await upgradeToPreferredBackCamera(stream);
            }
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            const reader = new ZXing.BrowserMultiFormatReader();
            readerRef.current = reader;
            activeRef.current = true;
            setStatus('Looking for barcode...');
            reader.decodeFromStream(stream, videoRef.current!, (result, err) => {
                if (result && activeRef.current) {
                const code = result.getText();
                setStatus(`Scanned: ${code}`);
                stopCamera();
                onScanned(code);
                if (!embedded) onClose();
                } else if (err && activeRef.current) {
                if ((err as Error & { name: string }).name !== 'NotFoundException') {
                    console.warn('Scan error:', err);
                }
                setStatus('Scanning...');
                }
            });
        } catch {
        setStatus('Cannot access camera. Please allow permissions.');
        }
    };

    const switchCamera = async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === 'videoinput');
        if (cams.length > 1) {
            cameraIndexRef.current = (cameraIndexRef.current + 1) % cams.length;
            deviceIdRef.current = cams[cameraIndexRef.current].deviceId;
            startCamera(deviceIdRef.current);
        } else {
            setStatus('Only one camera available.');
        }
    };

    useEffect(() => {
        if (isOpen && !embedded) {
            sheet.open();
            stopCamera();
            setTimeout(() => startCamera(deviceIdRef.current), 300);
        } else if (isOpen && embedded) {
            stopCamera();
            setTimeout(() => startCamera(deviceIdRef.current), 300);
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isOpen, embedded]);

    if (!isOpen) return null;

    if (embedded) {
        return (
            <video
                ref={videoRef}
                id="cameraVideo"
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
        );
    }

    return (
        <div
            className="app-overlay"
            id="cameraOverlay"
            ref={sheet.overlayRef}
            onClick={e => { if (e.target === sheet.overlayRef.current) sheet.close(); }}
            >
            <div className="modal" id="cameraModal" ref={sheet.modalRef} style={{ transform: 'translateY(100%)' }}>
                <div className="modal-handle-zone" id="cameraHandleZone" {...sheet.handleProps}>
                    <div className="modal-handle" />
                </div>
                <div className="modal-header">
                    <div className="modal-title">Scan Barcode</div>
                    <div className="modal-btn--right">
                        <button
                            id="closeCameraBtn"
                            className="back-btn"
                            style={{ background: 'var(--surface3)' }}
                            onClick={sheet.close}
                            >
                            <svg height="18" viewBox="0 -960 960 960" width="18" fill="currentColor">
                                <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                            </svg>
                        </button>
                    </div>
                </div>
                <div className="modal-body" style={{ padding: 16 }}>
                    <div style={{ position: 'relative' }}>
                        <video
                            ref={videoRef}
                            id="cameraVideo"
                            autoPlay
                            playsInline
                            muted
                            style={{ width: '100%', borderRadius: 'var(--radius-sm)', background: '#000' }}
                        />
                        <div className="camera-frame-overlay">
                            <div className="scan-frame" />
                        </div>
                    </div>
                    <div id="cameraStatus" className="search-status" style={{ marginTop: 12 }}>{status}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button
                            id="restartCameraBtn"
                            className="option-btn"
                            style={{ flex: 1 }}
                            onClick={() => { stopCamera(); setTimeout(() => startCamera(deviceIdRef.current), 100); }}
                            >
                            Restart Camera
                        </button>
                        <button
                            id="switchCameraBtn"
                            className="option-btn"
                            style={{ flex: 1 }}
                            onClick={switchCamera}
                            >
                            Switch Camera
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}