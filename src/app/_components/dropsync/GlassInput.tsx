'use client';

import { useRef, useState, useCallback } from 'react';

const SNAP_POINTS = [100, 150, 200, 250, 330, 400, 500, 750, 1000];
const SNAP_THRESH = 28;
const G_TOP = 6;
const G_BOT = 294;
const G_H = G_BOT - G_TOP; // 288

const SCALE_LEFT = [1000,900,800,700,600,500,400,300,200,100,0];
const SCALE_RIGHT = [1000,900,800,700,600,500,400,300,200,100,0];
const QUICK_AMOUNTS = [100,150,200,250,330,400,500,750,1000];

interface GlassInputProps {
  amount: number;
  onChange: (ml: number) => void;
  drinkColor?: string;
}

function nearestSnap(ml: number): number | null {
  let best: number | null = null;
  let bd = Infinity;
  for (const s of SNAP_POINTS) {
    const d = Math.abs(ml - s);
    if (d <= SNAP_THRESH && d < bd) { best = s; bd = d; }
  }
  return best;
}

function scaleTop(ml: number): number {
  return G_TOP + (1 - ml / 1000) * G_H;
}

export default function GlassInput({ amount, onChange }: GlassInputProps) {
  const dragStartYRef = useRef(0);
  const dragRaw0Ref = useRef(amount);
  const lastSnappedRef = useRef<number | null>(null);
  const [displayAmt, setDisplayAmt] = useState(amount);

  const fillPct = Math.max(0, Math.min(1, displayAmt / 1000));
  const fillY = G_BOT - G_H * fillPct;
  const fillHeight = G_H * fillPct;

  const commit = useCallback((ml: number) => {
    const clamped = Math.max(10, Math.min(1000, Math.round(ml / 10) * 10));
    setDisplayAmt(clamped);
    onChange(clamped);
  }, [onChange]);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartYRef.current = e.clientY;
    dragRaw0Ref.current = displayAmt;
    lastSnappedRef.current = null;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
    const dy = dragStartYRef.current - e.clientY;
    const deltaMl = (dy / G_H) * 1000;
    let newMl = Math.max(10, Math.min(1000, dragRaw0Ref.current + deltaMl));
    const snapped = nearestSnap(newMl);
    if (snapped !== null && snapped !== lastSnappedRef.current) {
      lastSnappedRef.current = snapped;
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(18);
      newMl = snapped;
    } else if (snapped === null) {
      lastSnappedRef.current = null;
    }
    commit(newMl);
  };

  const handlePointerUp = () => {
    const snapped = nearestSnap(displayAmt);
    if (snapped !== null) commit(snapped);
  };

  const quickSet = (ml: number) => { lastSnappedRef.current = ml; commit(ml); };

  return (
    <div className="modal-step active" id="ds-step2">
      <div className="amount-step-inner">
        <div className="amount-display">
          <div className="amount-num" id="ds-amountNum">{displayAmt}</div>
          <div className="amount-ml">ml</div>
        </div>

        <div className="glass-scale-wrap">
          <div className="scale-col left" id="ds-scaleLeft">
            {SCALE_LEFT.map(ml => (
              <div key={ml} className="scale-label" data-ml={ml} style={{ top: scaleTop(ml) + 'px' }}>
                {ml === 0 ? '' : ml}
              </div>
            ))}
          </div>

          <div
            className="glass-container"
            id="ds-glassContainer"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{ touchAction: 'none', cursor: 'ns-resize' }}
          >
            <svg className="glass-svg" viewBox="0 0 140 300">
              <defs>
                <clipPath id="ds-fillClip">
                  <rect id="ds-fillRect" x="0" y={fillY} width="140" height={fillHeight + 10} />
                </clipPath>
                <linearGradient id="ds-fillGrad" x1="0" y1="6" x2="0" y2="294" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#00d2e5" />
                  <stop offset="100%" stopColor="#1a6fd4" />
                </linearGradient>
                <clipPath id="ds-glassBodyClip">
                  <path d="M4,6 L28,284 Q28,294 38,294 L102,294 Q112,294 112,284 L136,6 Z" />
                </clipPath>
                <linearGradient id="ds-glassBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%"   stopColor="rgba(255,255,255,0.20)" />
                  <stop offset="12%"  stopColor="rgba(255,255,255,0.38)" />
                  <stop offset="30%"  stopColor="rgba(255,255,255,0.05)" />
                  <stop offset="70%"  stopColor="rgba(255,255,255,0.04)" />
                  <stop offset="88%"  stopColor="rgba(255,255,255,0.26)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.14)" />
                </linearGradient>
                <linearGradient id="ds-leftEdge" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%"   stopColor="rgba(255,255,255,0.60)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.00)" />
                </linearGradient>
                <linearGradient id="ds-rightEdge" x1="100%" y1="0%" x2="0%" y2="0%">
                  <stop offset="0%"   stopColor="rgba(255,255,255,0.42)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.00)" />
                </linearGradient>
                <linearGradient id="ds-rimGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%"   stopColor="rgba(255,255,255,0.12)" />
                  <stop offset="30%"  stopColor="rgba(255,255,255,0.80)" />
                  <stop offset="70%"  stopColor="rgba(255,255,255,0.60)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.12)" />
                </linearGradient>
                <radialGradient id="ds-bottomDepth" cx="50%" cy="100%" r="55%">
                  <stop offset="0%"   stopColor="rgba(0,20,70,0.32)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.00)" />
                </radialGradient>
                <linearGradient id="ds-innerTopShadow" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%"  stopColor="rgba(0,0,0,0.18)" />
                  <stop offset="18%" stopColor="rgba(0,0,0,0.00)" />
                </linearGradient>
              </defs>

              <ellipse cx="70" cy="297" rx="46" ry="4" fill="rgba(0,0,0,0.20)" style={{ filter: 'blur(4px)' }} />
              <path d="M4,6 L28,284 Q28,294 38,294 L102,294 Q112,294 112,284 L136,6 Z"
                fill="url(#ds-fillGrad)" clipPath="url(#ds-fillClip)" />
              <g clipPath="url(#ds-glassBodyClip)">
                <g id="ds-waveGroup">
                  <path id="ds-wavePath" fill="url(#ds-fillGrad)" />
                </g>
              </g>
              <path d="M4,6 L28,284 Q28,294 38,294 L102,294 Q112,294 112,284 L136,6 Z"
                fill="url(#ds-bottomDepth)" clipPath="url(#ds-fillClip)" />
              <ellipse id="ds-fillSurface" cx="70" cy="294" rx="42" ry="3.5"
                fill="url(#ds-fillGrad)" opacity="0" />
              <ellipse id="ds-fullRimFill" cx="70" cy="6" rx="66" ry="5.5"
                fill="url(#ds-fillGrad)" opacity={displayAmt >= 990 ? 1 : 0} />
              <path d="M4,6 L28,284 Q28,294 38,294 L102,294 Q112,294 112,284 L136,6"
                fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" strokeLinecap="round" />
              <rect x="4"   y="6" width="20" height="292" fill="url(#ds-leftEdge)"  clipPath="url(#ds-glassBodyClip)" />
              <rect x="116" y="6" width="20" height="292" fill="url(#ds-rightEdge)" clipPath="url(#ds-glassBodyClip)" />
              <path d="M4,6 L28,284 Q28,294 38,294 L102,294 Q112,294 112,284 L136,6 Z"
                fill="url(#ds-innerTopShadow)" clipPath="url(#ds-glassBodyClip)" />
              <ellipse cx="70" cy="6" rx="66" ry="6"
                fill="rgba(200,230,255,0.18)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
              <ellipse cx="70" cy="290" rx="42" ry="5"
                fill="rgba(180,220,255,0.18)" stroke="rgba(255,255,255,0.24)" strokeWidth="1" />
              <ellipse cx="70" cy="290" rx="32" ry="3" fill="rgba(10,40,120,0.18)" />
            </svg>
          </div>

          <div className="scale-col right" id="ds-scaleRight">
            {SCALE_RIGHT.map(ml => (
              <div key={ml} className="scale-label" data-ml={ml} style={{ top: scaleTop(ml) + 'px' }}>
                {ml === 1000 || ml === 500 || ml === 400 || ml === 200 || ml === 100 ? '-' : ''}
              </div>
            ))}
          </div>
        </div>

        <div className="quick-amounts">
          {QUICK_AMOUNTS.map(ml => (
            <button key={ml} className={`quick-btn${displayAmt === ml ? ' active' : ''}`}
              data-ml={ml} onClick={() => quickSet(ml)}>
              {ml} ml
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
