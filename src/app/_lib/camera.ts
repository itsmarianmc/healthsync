export function pickPreferredBackCamera(cameras: MediaDeviceInfo[]): string | undefined {
    if (cameras.length === 0) return undefined;

    const backCams = cameras.filter((cam) => /back|rear|environment/i.test(cam.label));
    if (backCams.length === 0) return undefined;
    if (backCams.length === 1) return backCams[0].deviceId;

    const mainCam = backCams.find((cam) => !/ultra|tele|macro|depth|infrared/i.test(cam.label));
    return (mainCam ?? backCams[0]).deviceId;
}

export async function findPreferredBackCameraDeviceId(): Promise<string | undefined> {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((device) => device.kind === 'videoinput');
        return pickPreferredBackCamera(cams);
    } catch {
        return undefined;
    }
}

export function barcodeCameraConstraints(deviceId?: string): MediaStreamConstraints[] {
    const quality: MediaTrackConstraints = {
        width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 },
    };
    return deviceId
        ? [{ video: { ...quality, deviceId: { exact: deviceId } } }, { video: { ...quality, deviceId: { ideal: deviceId } } }, { video: { ...quality, facingMode: { ideal: 'environment' } } }]
        : [{ video: { ...quality, facingMode: { ideal: 'environment' } } }, { video: quality }, { video: { facingMode: { ideal: 'user' } } }];
}

export async function applyBarcodeFocus(track: MediaStreamTrack): Promise<void> {
    const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { focusMode?: string[] };
    if (!capabilities?.focusMode?.includes('continuous')) return;
    try {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] });
    } catch {
        console.warn('Failed to apply continuous focus mode to camera track.');
    }
}

export function describeCameraError(error: unknown): string {
    const name = (error as DOMException | undefined)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission was denied. Allow camera access in your browser settings.';
    if (name === 'NotFoundError') return 'No camera was found. Connect a camera or enter the barcode manually.';
    if (name === 'NotReadableError' || name === 'TrackStartError') return 'Camera is already in use by another app. Close it and try again.';
    if (name === 'OverconstrainedError') return 'This camera does not support the requested scan settings. Try another camera.';
    if (name === 'AbortError') return 'Camera startup was interrupted. Try again.';
    return 'Cannot access the camera. Check browser permissions and try again.';
}

export function friendlyCameraLabel(cam: MediaDeviceInfo, index: number): string {
    const label = cam.label || '';
    if (/ultra.*wide/i.test(label)) return 'Ultra Wide';
    if (/tele(photo)?/i.test(label)) return 'Telephoto';
    if (/macro/i.test(label)) return 'Macro';
    if (/front|user/i.test(label)) return 'Front Camera';
    if (/back|rear|environment/i.test(label)) return 'Back Camera';
    return label || `Camera ${index + 1}`;
}
