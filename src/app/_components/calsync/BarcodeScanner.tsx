'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';
import { applyBarcodeFocus, barcodeCameraConstraints, describeCameraError, friendlyCameraLabel } from '../../_lib/camera';

interface BarcodeScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onScanned: (barcode: string) => void;
    embedded?: boolean;
    selectedDeviceId?: string;
    onCamerasChange?: (cameras: MediaDeviceInfo[], activeDeviceId?: string) => void;
    onStatusChange?: (status: string) => void;
}

type Reader = {
    decodeFromStream: (stream: MediaStream, video: HTMLVideoElement, callback: (result: { getText: () => string } | null, error: Error | null) => void) => void;
    reset?: () => void;
    stop?: () => void;
};

export default function BarcodeScanner({ isOpen, onClose, onScanned, embedded, selectedDeviceId, onCamerasChange, onStatusChange }: BarcodeScannerProps) {
    const sheet = useDraggableSheet({ onClose });
    const openSheet = sheet.open;
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const readerRef = useRef<Reader | null>(null);
    const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeRef = useRef(false);
    const mountedRef = useRef(true);
    const startEpochRef = useRef(0);
    const deviceIdRef = useRef<string | undefined>(undefined);
    const scannedRef = useRef(false);
    const onScannedRef = useRef(onScanned);
    const onStatusChangeRef = useRef(onStatusChange);
    const onCamerasChangeRef = useRef(onCamerasChange);
    const [status, setStatus] = useState('Preparing camera...');
    const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
    const [activeDeviceId, setActiveDeviceId] = useState<string>();

    useEffect(() => { onScannedRef.current = onScanned; }, [onScanned]);
    useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);
    useEffect(() => { onCamerasChangeRef.current = onCamerasChange; }, [onCamerasChange]);
    const updateStatus = useCallback((message: string) => { setStatus(message); onStatusChangeRef.current?.(message); }, []);

    const stopCamera = useCallback(() => {
        startEpochRef.current += 1;
        activeRef.current = false;
        try { readerRef.current?.stop?.(); readerRef.current?.reset?.(); } catch {}
        readerRef.current = null;
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
    }, []);

    const refreshCameraList = useCallback(async (activeId?: string) => {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        try {
            const cams = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput');
            if (!mountedRef.current) return;
            setCameras(cams);
            onCamerasChangeRef.current?.(cams, activeId);
        } catch { /* The scanner remains usable when camera enumeration is unavailable. */ }
    }, []);

    const startCamera = useCallback(async (requestedDeviceId?: string) => {
        if (!navigator.mediaDevices?.getUserMedia) { updateStatus('Camera scanning is not supported by this browser. Enter the barcode manually.'); return; }
        const ZXing = (window as unknown as { ZXingBrowser?: { BrowserMultiFormatReader: new () => Reader } }).ZXingBrowser;
        if (!ZXing) { updateStatus('Barcode scanner is still loading. Try again in a moment.'); return; }
        const epoch = startEpochRef.current;
        scannedRef.current = false;
        updateStatus('Starting camera...');
        let lastError: unknown;
        let stream: MediaStream | undefined;
        for (const constraints of barcodeCameraConstraints(requestedDeviceId)) {
            try { stream = await navigator.mediaDevices.getUserMedia(constraints); break; } catch (error) { lastError = error; }
        }
        if (!stream) { if (epoch === startEpochRef.current) updateStatus(describeCameraError(lastError)); return; }
        if (epoch !== startEpochRef.current || !mountedRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        if (!track) { stopCamera(); updateStatus('The selected camera has no video track. Try another camera.'); return; }
        await applyBarcodeFocus(track);
        const actualDeviceId = track.getSettings().deviceId;
        deviceIdRef.current = actualDeviceId;
        setActiveDeviceId(actualDeviceId);
        void refreshCameraList(actualDeviceId);
        const video = videoRef.current;
        if (!video) { stopCamera(); return; }
        video.srcObject = stream;
        try { await video.play(); } catch (error) { stopCamera(); updateStatus(describeCameraError(error)); return; }
        if (epoch !== startEpochRef.current) return;
        const reader = new ZXing.BrowserMultiFormatReader();
        readerRef.current = reader;
        activeRef.current = true;
        updateStatus('Point the camera at a barcode...');
        reader.decodeFromStream(stream, video, (result, error) => {
            if (!mountedRef.current || !activeRef.current || scannedRef.current) return;
            if (result?.getText()) {
                scannedRef.current = true;
                const code = result.getText();
                updateStatus(`Scanned: ${code}`);
                stopCamera();
                onScannedRef.current(code);
                if (!embedded) onClose();
                return;
            }
            const name = (error as Error | null)?.name;
            if (name && !['NotFoundException', 'FormatException', 'ChecksumException'].includes(name)) {
                updateStatus('Having trouble reading this code. Hold it steady, improve the light, or try another camera.');
            }
        });
    }, [embedded, onClose, refreshCameraList, stopCamera, updateStatus]);

    const scheduleStart = useCallback((deviceId?: string, delay = 250) => {
        if (startTimerRef.current) clearTimeout(startTimerRef.current);
        startTimerRef.current = setTimeout(() => { startTimerRef.current = null; if (mountedRef.current) void startCamera(deviceId); }, delay);
    }, [startCamera]);

    useEffect(() => {
        if (!isOpen) return;
        const handleDeviceChange = () => void refreshCameraList(deviceIdRef.current);
        navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
        return () => navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
    }, [isOpen, refreshCameraList]);

    useEffect(() => {
        if (!isOpen || !selectedDeviceId || selectedDeviceId === deviceIdRef.current) return;
        stopCamera();
        scheduleStart(selectedDeviceId, 50);
    }, [isOpen, scheduleStart, selectedDeviceId, stopCamera]);

    useEffect(() => {
        mountedRef.current = true;
        if (isOpen) {
            if (!embedded) openSheet();
            stopCamera();
            scheduleStart(selectedDeviceId ?? deviceIdRef.current);
        } else stopCamera();
        return () => {
            mountedRef.current = false;
            if (startTimerRef.current) clearTimeout(startTimerRef.current);
            stopCamera();
        };
    }, [embedded, isOpen, openSheet, scheduleStart, selectedDeviceId, stopCamera]);

    if (!isOpen) return null;
    const video = <video ref={videoRef} id="cameraVideo" autoPlay playsInline muted style={{ width: '100%', height: embedded ? '100%' : undefined, objectFit: 'cover', display: 'block' }} />;
    if (embedded) return video;

    return <div className="app-overlay" id="cameraOverlay" ref={sheet.overlayRef} onClick={event => { if (event.target === sheet.overlayRef.current) sheet.close(); }}>
        <div className="modal" id="cameraModal" ref={sheet.modalRef} style={{ transform: 'translateY(100%)' }}>
            <div className="modal-handle-zone" id="cameraHandleZone" {...sheet.handleProps}><div className="modal-handle" /></div>
            <div className="modal-header"><div className="modal-title">Scan Barcode</div><div className="modal-btn--right"><button id="closeCameraBtn" className="back-btn" style={{ background: 'var(--surface3)' }} onClick={sheet.close} aria-label="Close scanner">×</button></div></div>
            <div className="modal-body" style={{ padding: 16 }}><div style={{ position: 'relative' }}>{video}<div className="camera-frame-overlay"><div className="scan-frame" /></div></div>
                {cameras.length > 1 && <select className="form-input camera-select" value={activeDeviceId} onChange={event => { stopCamera(); scheduleStart(event.target.value, 50); }} style={{ marginTop: 12 }}>{cameras.map((cam, index) => <option key={cam.deviceId || index} value={cam.deviceId}>{friendlyCameraLabel(cam, index)}</option>)}</select>}
                <div id="cameraStatus" className="search-status" style={{ marginTop: 12 }}>{status}</div>
                <button id="restartCameraBtn" className="option-btn" style={{ width: '100%', marginTop: 12 }} onClick={() => { stopCamera(); scheduleStart(deviceIdRef.current, 50); }}>Restart Camera</button>
            </div>
        </div>
    </div>;
}
