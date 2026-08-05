'use client';

import { useState, useRef, useEffect } from 'react';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { resolveBackCameraConstraints, upgradeToPreferredBackCamera } from '../../_lib/camera';

interface ExtendedMediaTrackCapabilities extends MediaTrackCapabilities {
    focusMode?: string[];
    zoom?: { min: number; max: number; step: number };
}

interface ExtendedMediaTrackConstraintSet extends MediaTrackConstraintSet {
    focusMode?: string;
    zoom?: number;
}

interface ExtendedMediaTrackConstraints extends MediaTrackConstraints {
    advanced?: ExtendedMediaTrackConstraintSet[];
}

interface ExtendedMediaTrackSettings extends MediaTrackSettings {
    zoom?: number;
}

interface BarcodeScanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScanned: (barcode: string) => void;
}

export default function BarcodeScanModal({ isOpen, onClose, onScanned }: BarcodeScanModalProps) {
    const sheet = useDraggableSheet({ onClose });
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState('Looking for barcode...');
    const streamRef = useRef<MediaStream | null>(null);
    const readerRef = useRef<unknown>(null);
    const activeRef = useRef(false);
    const deviceIdRef = useRef<string | undefined>(undefined);
    const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
    const videoTrackRef = useRef<MediaStreamTrack | null>(null);
    const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
    const [zoom, setZoom] = useState<number | null>(null);

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
        videoTrackRef.current = null;
        setZoomRange(null);
        setZoom(null);
    };

    const refreshCameraList = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cams = devices.filter(d => d.kind === 'videoinput');
            setCameras(cams);
        } catch {
            console.warn('Failed to enumerate devices. This may be due to browser permissions or lack of support.');
        }
    };

    const getStreamWithRetry = async (
        constraints: MediaStreamConstraints,
        attempts = 4,
        delayMs = 350
    ): Promise<MediaStream> => {
        let lastError: unknown;
        for (let i = 0; i < attempts; i++) {
            try {
                return await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                lastError = err;
                const name = (err as DOMException)?.name;
                const retryable = name === 'NotReadableError' || name === 'OverconstrainedError' || name === 'AbortError';
                if (!retryable || i === attempts - 1) throw err;
                setStatus(`Camera busy, retrying... (${i + 1}/${attempts - 1})`);
                await new Promise(res => setTimeout(res, delayMs * (i + 1)));
            }
        }
        throw lastError;
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
            let stream = await getStreamWithRetry(constraints);
            // FIX: the browser may hand back the ultrawide back camera (short focal
            // length, focuses on distant subjects). Prefer the plain "Back Camera" so
            // close-up barcodes stay sharp and scannable.
            if (!deviceId) {
                stream = await upgradeToPreferredBackCamera(stream);
            }
            streamRef.current = stream;
            const activeDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId;
            deviceIdRef.current = activeDeviceId;
            setSelectedDeviceId(activeDeviceId);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            refreshCameraList();

            const videoTrack = stream.getVideoTracks()[0];
            videoTrackRef.current = videoTrack ?? null;
            if (videoTrack) {
                const caps = (videoTrack.getCapabilities?.() ?? {}) as ExtendedMediaTrackCapabilities;
                const advanced: ExtendedMediaTrackConstraintSet[] = [];
                if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
                    advanced.push({ focusMode: 'continuous' });
                }
                if (advanced.length > 0) {
                    try {
                        await videoTrack.applyConstraints({ advanced } as ExtendedMediaTrackConstraints);
                    } catch { /* best effort */ }
                }
                if (caps.zoom) {
                    const z = caps.zoom;
                    if (typeof z.min === 'number' && typeof z.max === 'number' && z.max > z.min) {
                        setZoomRange({ min: z.min, max: z.max, step: z.step || (z.max - z.min) / 100 });
                        const settings = videoTrack.getSettings() as ExtendedMediaTrackSettings;
                        setZoom(typeof settings.zoom === 'number' ? settings.zoom : z.min);
                    }
                }
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
                } else if (err && activeRef.current) {
                if ((err as Error & { name: string }).name !== 'NotFoundException') {
                    console.warn('Scan error:', err);
                }
                setStatus('Scanning...');
                }
            });
        } catch (err) {
            const name = (err as DOMException)?.name;
            if (name === 'NotAllowedError') {
                setStatus('Cannot access camera. Please allow camera permission.');
            } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
                setStatus('That camera is not available on this device.');
            } else {
                setStatus(`Camera error: ${name || 'unknown'}. Try restarting.`);
            }
            console.warn('Camera start failed:', err);
        }
    };

    const selectCamera = (deviceId: string) => {
        if (deviceId === selectedDeviceId) return;
        stopCamera();
        setTimeout(() => startCamera(deviceId), 300);
    };

    const handleZoomChange = async (value: number) => {
        setZoom(value);
        const track = videoTrackRef.current;
        if (!track) return;
        try {
            await track.applyConstraints({ advanced: [{ zoom: value }] } as ExtendedMediaTrackConstraints);
        } catch {
            console.warn('Failed to apply zoom constraint. This may not be supported on this device.');
        }
    };

    useEffect(() => {
        if (isOpen) {
            sheet.open();
            stopCamera();
            setTimeout(() => startCamera(deviceIdRef.current), 300);
        } else {
            stopCamera();
            if (sheet.stateRef.current !== 'closed') sheet.close();
        }
        return () => stopCamera();
    }, [isOpen]);

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
                    {zoomRange && zoom !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                            <span style={{ fontSize: 13, opacity: 0.75 }}>Zoom</span>
                            <input
                                id="cameraZoomSlider"
                                type="range"
                                min={zoomRange.min}
                                max={zoomRange.max}
                                step={zoomRange.step}
                                value={zoom}
                                onChange={e => handleZoomChange(parseFloat(e.target.value))}
                                style={{ flex: 1 }}
                            />
                        </div>
                    )}
                    {cameras.length > 1 && (
                        <select
                            id="cameraSelect"
                            value={selectedDeviceId ?? ''}
                            onChange={e => selectCamera(e.target.value)}
                            style={{
                                width: '100%',
                                marginTop: 12,
                                padding: '10px 12px',
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--surface3)',
                                color: 'inherit',
                                border: '1px solid var(--border, transparent)',
                            }}
                        >
                            {cameras.map((cam, i) => (
                                <option key={cam.deviceId} value={cam.deviceId}>
                                    {cam.label || `Camera ${i + 1}`}
                                </option>
                            ))}
                        </select>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button
                            id="restartCameraBtn"
                            className="option-btn"
                            style={{ flex: 1 }}
                            onClick={() => { stopCamera(); setTimeout(() => startCamera(deviceIdRef.current), 300); }}
                            >
                            Restart Camera
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}