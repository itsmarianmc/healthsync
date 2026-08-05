/**
 * Camera selection helpers for barcode scanning.
 *
 * Multi-camera phones expose several back-facing cameras (main, ultrawide,
 * telephoto, macro). When the browser is asked for a back camera via
 * `facingMode: 'environment'` it may hand back the ultrawide, whose short
 * focal length keeps distant subjects in focus but makes close-up barcodes
 * tiny and unreadable. These helpers prefer the plain "Back Camera".
 */

/**
 * Given a list of video input devices, return the deviceId of the preferred
 * "main" back-facing camera. Returns undefined when no labeled back camera is
 * available (e.g. before camera permission has been granted).
 */
export function pickPreferredBackCamera(cameras: MediaDeviceInfo[]): string | undefined {
    if (cameras.length === 0) return undefined;

    const backCams = cameras.filter((cam) => /back|rear|environment/i.test(cam.label));
    if (backCams.length === 0) return undefined;
    if (backCams.length === 1) return backCams[0].deviceId;

    // Prefer the main camera: not ultrawide, telephoto, macro, depth or IR.
    const mainCam = backCams.find((cam) => !/ultra|tele|macro|depth|infrared/i.test(cam.label));
    return (mainCam ?? backCams[0]).deviceId;
}

/**
 * Enumerate video inputs and return the preferred main back camera's deviceId.
 * Device labels are only populated once camera permission has been granted, so
 * this returns undefined on the very first run before any getUserMedia call.
 */
export async function findPreferredBackCameraDeviceId(): Promise<string | undefined> {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((device) => device.kind === 'videoinput');
        return pickPreferredBackCamera(cams);
    } catch {
        return undefined;
    }
}

/**
 * Build video constraints for a back camera. When a specific `deviceId` is
 * supplied it is requested exactly. Otherwise we try to identify the main back
 * camera from already-populated labels (permission previously granted) and
 * request it directly; if labels are not yet available we fall back to
 * `facingMode: 'environment'` (which also prompts for permission).
 */
export async function resolveBackCameraConstraints(deviceId?: string): Promise<MediaStreamConstraints> {
    if (deviceId) {
        return { video: { deviceId: { exact: deviceId } } };
    }
    const preferredId = await findPreferredBackCameraDeviceId();
    if (preferredId) {
        return { video: { deviceId: { exact: preferredId } } };
    }
    return { video: { facingMode: 'environment' } };
}

/**
 * After a probe stream has been acquired (which grants permission and populates
 * device labels), swap to the preferred main back camera when the active one is
 * the ultrawide/telephoto. The original stream is only released once the
 * preferred camera is acquired successfully, so callers always end up with a
 * usable stream.
 */
export async function upgradeToPreferredBackCamera(stream: MediaStream): Promise<MediaStream> {
    const preferredId = await findPreferredBackCameraDeviceId();
    const activeTrack = stream.getVideoTracks()[0];
    const activeId = activeTrack?.getSettings().deviceId;
    if (!preferredId || preferredId === activeId) return stream;
    try {
        const upgraded = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: preferredId } },
        });
        stream.getTracks().forEach((track) => track.stop());
        return upgraded;
    } catch {
        // Keep the original stream if the preferred camera cannot be acquired.
        return stream;
    }
}
