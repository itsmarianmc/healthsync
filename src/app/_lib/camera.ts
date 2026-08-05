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
        return stream;
    }
}
