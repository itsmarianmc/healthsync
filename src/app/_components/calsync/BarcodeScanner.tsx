'use client';

import { useState, useRef, useEffect } from 'react';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { resolveBackCameraConstraints, upgradeToPreferredBackCamera, friendlyCameraLabel } from '../../_lib/camera';

interface BarcodeScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onScanned: (barcode: string) => void;
    embedded?: boolean;
    selectedDeviceId?: string;
    onCamerasChange?: (cameras: MediaDeviceInfo[], activeDeviceId?: string) => void;
}

export default function BarcodeScanner({ isOpen, onClose, onScanned, embedded, selectedDeviceId, onCamerasChange }: BarcodeScannerProps) {
    const sheet = useDraggableSheet({ onClose });
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Looking for barcode...');
    const streamRef = useRef<MediaStream | null>(null);
    const readerRef = useRef<unknown>(null);
    const activeRef = useRef(false);
    const deviceIdRef = useRef<string | undefined>(undefined);
    const mountedRef = useRef(true);
    const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startEpochRef = useRef(0);

    const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
    const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>(undefined);

    const onCamerasChangeRef = useRef(onCamerasChange);
    useEffect(() => { onCamerasChangeRef.current = onCamerasChange; }, [onCamerasChange]);

    const stopCamera = () => {
        startEpochRef.current += 1;
        activeRef.current = false;
        if (readerRef.current) {
            try {
                const reader = readerRef.current as { reset: () => void; stop: () => void };
                if (typeof reader.stop === 'function') {
                    reader.stop();
                } else {
                    reader.reset();
                }
            } catch {}
            readerRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
    };

    const refreshCameraList = async (activeId: string | undefined) => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cams = devices.filter(d => d.kind === 'videoinput');
            setCameras(cams);
            onCamerasChangeRef.current?.(cams, activeId);
        } catch {}
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
        const epoch = startEpochRef.current;
            const constraints: MediaStreamConstraints = await resolveBackCameraConstraints(deviceId);
        if (epoch !== startEpochRef.current) return;
        try {
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            let stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (epoch !== startEpochRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
            if (!deviceId) {
                stream = await upgradeToPreferredBackCamera(stream);
                if (epoch !== startEpochRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
            }
            streamRef.current = stream;
            const settingsDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId;
            deviceIdRef.current = settingsDeviceId;
            setActiveDeviceId(settingsDeviceId);
            refreshCameraList(settingsDeviceId);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            if (epoch !== startEpochRef.current) return;
            const reader = new ZXing.BrowserMultiFormatReader();
            readerRef.current = reader;
            activeRef.current = true;
            setStatus('Looking for barcode...');
            reader.decodeFromStream(stream, videoRef.current!, (result, err) => {
                if (!mountedRef.current || !activeRef.current) return;
                if (result) {
                const code = result.getText();
                setStatus(`Scanned: ${code}`);
                stopCamera();
                onScanned(code);
                if (!embedded) onClose();
                } else if (err) {
                if ((err as Error & { name: string }).name !== 'NotFoundException') {
                    console.warn('Scan error:', err);
                }
                if (mountedRef.current && activeRef.current) setStatus('Scanning...');
                }
            });
        } catch {
        setStatus('Cannot access camera. Please allow permissions.');
        }
    };

    const scheduleStart = (deviceId?: string, delay = 300) => {
        if (startTimerRef.current) clearTimeout(startTimerRef.current);
        startTimerRef.current = setTimeout(() => {
            startTimerRef.current = null;
            if (!mountedRef.current) return;
            startCamera(deviceId);
        }, delay);
    };

    useEffect(() => {
        if (!selectedDeviceId || selectedDeviceId === deviceIdRef.current) return;
        stopCamera();
        startCamera(selectedDeviceId);
    }, [selectedDeviceId]);

    useEffect(() => {
        mountedRef.current = true;
        if (isOpen && !embedded) {
            sheet.open();
            stopCamera();
            scheduleStart(deviceIdRef.current, 300);
        } else if (isOpen && embedded) {
            stopCamera();
            scheduleStart(deviceIdRef.current, 300);
        } else {
            stopCamera();
        }
        return () => {
            mountedRef.current = false;
            if (startTimerRef.current) { clearTimeout(startTimerRef.current); startTimerRef.current = null; }
            stopCamera();
        };
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
                    {cameras.length > 1 && (
                        <select
                            className="form-input camera-select"
                            value={activeDeviceId}
                            onChange={e => { stopCamera(); startCamera(e.target.value); }}
                            style={{ marginTop: 12 }}
                        >
                            {cameras.map((cam, i) => (
                                <option key={cam.deviceId || i} value={cam.deviceId}>{friendlyCameraLabel(cam, i)}</option>
                            ))}
                        </select>
                    )}
                    <div id="cameraStatus" className="search-status" style={{ marginTop: 12 }}>{status}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button
                            id="restartCameraBtn"
                            className="option-btn"
                            style={{ flex: 1 }}
                            onClick={() => { stopCamera(); scheduleStart(deviceIdRef.current, 100); }}
                            >
                            Restart Camera
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
