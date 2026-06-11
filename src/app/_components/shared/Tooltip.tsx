'use client';

import { useEffect, useState } from 'react';

interface TooltipStep {
  elementId: string;
  message: string;
  progress: string;
  buttonText?: string;
}

interface TooltipState {
  visible: boolean;
  elementId: string;
  message: string;
  progress: string;
  buttonText: string;
  top: number;
  left: number;
  above: boolean;
  onNext: () => void;
}

let _resolveTooltip: (() => void) | null = null;

export function showToolTip(
  elementId: string, message: string, progress: string,
  buttonText: string, onNext: () => void
) {
  const el = document.getElementById(elementId);
  if (!el) { onNext(); return; }
  const rect = el.getBoundingClientRect();
  const above = rect.top > window.innerHeight / 2;
  const top = above ? rect.top + window.scrollY - 12 : rect.bottom + window.scrollY + 12;
  const left = Math.min(Math.max(rect.left + rect.width / 2, 20), window.innerWidth - 20);

  window.dispatchEvent(new CustomEvent('__showTooltip', {
    detail: { visible: true, elementId, message, progress, buttonText, top, left, above, onNext }
  }));
}

export function closeToolTip() {
  window.dispatchEvent(new CustomEvent('__showTooltip', { detail: { visible: false } }));
}

export default function Tooltip() {
  const [state, setState] = useState<TooltipState | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail.visible) { setState(null); return; }
      setState(detail as TooltipState);
    };
    window.addEventListener('__showTooltip', handler);
    return () => window.removeEventListener('__showTooltip', handler);
  }, []);

  if (!state?.visible) return null;

  const { message, progress, buttonText, top, left, above, onNext, elementId } = state;

  // Highlight the target element
  const targetEl = document.getElementById(elementId);
  if (targetEl) {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <>
      <div className="tooltip-overlay" onClick={closeToolTip} />
      <div
        className={`tooltip-bubble${above ? ' above' : ' below'}`}
        style={{ position: 'fixed', top, left, transform: 'translateX(-50%)', zIndex: 9999 }}
      >
        <div className="tooltip-progress">{progress}</div>
        <div className="tooltip-message" dangerouslySetInnerHTML={{ __html: message }} />
        <button className="tooltip-btn" onClick={onNext}>{buttonText || 'Next'}</button>
      </div>
    </>
  );
}
