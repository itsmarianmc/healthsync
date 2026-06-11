'use client';

import { useState, useRef, useEffect } from 'react';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
}

export default function BarcodeScanner({ isOpen, onClose, onScanned }: BarcodeScannerProps) {
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
      BrowserMultiFormatReader: new() => {
        decodeFromStream: (stream: MediaStream, video: HTMLVideoElement, cb: (result: { getText: () => string } | null, err: Error | null) => void) => void;
        reset: () => void;
      }
    };
    if (!ZXing) { setStatus('Barcode library not loaded.'); return; }
    const constraints: MediaStreamConstraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }
    };
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
          onClose();
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
    if (isOpen) {
      stopCamera();
      setTimeout(() => startCamera(deviceIdRef.current), 300);
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="overlay visible" id="cameraOverlay" onClick={onClose} />
      <div className="bottom-sheet camera-sheet" id="cameraModal" style={{ transform: 'translateY(0)' }}>
        <div className="sheet-handle-zone" id="cameraHandleZone">
          <div className="sheet-handle" />
          <div className="sheet-header">
            <div className="sheet-title">Scan Barcode</div>
            <button id="closeCameraBtn" onClick={onClose} className="sheet-close-btn">
              <svg height="20" viewBox="0 -960 960 960" width="20" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
            </button>
          </div>
        </div>
        <div className="camera-body">
          <div className="camera-preview">
            <video ref={videoRef} id="cameraVideo" autoPlay playsInline muted />
            <div className="camera-overlay-frame" />
          </div>
          <div className="camera-status" id="cameraStatus">{status}</div>
          <div className="camera-controls">
            <button id="restartCameraBtn" className="option-btn" onClick={() => startCamera(deviceIdRef.current)}>
              <i className="fa-solid fa-rotate" /> Restart
            </button>
            <button id="switchCameraBtn" className="option-btn" onClick={switchCamera}>
              <i className="fa-solid fa-camera-rotate" /> Switch
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
