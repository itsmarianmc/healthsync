'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAiDetection } from '../../_context/AiDetectionContext';

export default function AiDetectionIndicator() {
    const { detections } = useAiDetection();
    const router = useRouter();
    const pathname = usePathname();

    const inFlight = detections.filter(d => d.status === 'awaiting-file' || d.status === 'analyzing');
    if (inFlight.length === 0) return null;

    const firstAnalyzing = inFlight.find(d => d.status === 'analyzing');
    const label = firstAnalyzing
        ? `Analyzing ${inFlight.length > 1 ? `(${inFlight.length})` : '…'}`
        : `Waiting for files${inFlight.length > 1 ? ` (${inFlight.length})` : ''}`;

    const onClick = () => {
        if (pathname !== '/food') router.push('/food');
    };

    return (
        <button
            type="button"
            className="ai-detection-indicator"
            onClick={onClick}
            title="AI detection in progress"
            aria-label={label}
        >
            <i className={`fa-solid ${firstAnalyzing ? 'fa-circle-notch fa-spin' : 'fa-image'}`} />
            <span>{label}</span>
        </button>
    );
}
