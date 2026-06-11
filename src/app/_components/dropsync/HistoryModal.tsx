'use client';

import React, { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import type { DrinkEntry } from '../../_lib/types';

interface HistoryModalProps {
  entries: DrinkEntry[];
  isOpen: boolean;
  onClose: () => void;
}

const SHEET_TOP_MARGIN = 24;
const EASE = 'cubic-bezier(0.34, 1.15, 0.64, 1)';

function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function fmtMl(ml: number) {
  return ml >= 1000 ? (ml/1000).toFixed(1).replace('.',',') + ' L' : ml + ' ml';
}

function formatDateLabel(dateStr: string) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function HistoryModal({ entries, isOpen, onClose }: HistoryModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const naturalHeightRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragDYRef = useRef(0);
  const velRef = useRef(0);
  const dragLastYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const isCapturingRef = useRef(false);
  const [modalState, setModalState] = useState<'closed' | 'open' | 'expanded'>('closed');

  const expandedHeight = () => window.innerHeight - SHEET_TOP_MARGIN;
  const setNoTransition = () => { if (modalRef.current) modalRef.current.style.transition = 'none'; };

  // Close the sheet when this route becomes hidden via Activity
  useLayoutEffect(() => {
    return () => {
      setModalState('closed');
    };
  }, []);
  const setTransition = (props: string[]) => {
    if (!modalRef.current) return;
    modalRef.current.style.transition = props.map(p => `${p} 0.42s ${EASE}`).join(', ');
  };

  const snapToOpen = useCallback(() => {
    setModalState('open');
    setTransition(['height', 'transform']);
    if (modalRef.current) {
      modalRef.current.style.height = naturalHeightRef.current + 'px';
      modalRef.current.style.transform = 'translateY(0)';
    }
  }, []);

  const snapToExpanded = useCallback(() => {
    setModalState('expanded');
    setTransition(['height', 'transform']);
    if (modalRef.current) {
      modalRef.current.style.height = expandedHeight() + 'px';
      modalRef.current.style.transform = 'translateY(0)';
    }
  }, []);

  const snapToClosed = useCallback(() => {
    if (!modalRef.current) return;
    setModalState('closed');
    const curH = modalRef.current.offsetHeight;
    setNoTransition();
    modalRef.current.style.height = curH + 'px';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!modalRef.current) return;
      modalRef.current.style.transition = `transform 0.36s cubic-bezier(0.4, 0, 0.2, 1)`;
      modalRef.current.style.transform = 'translateY(110%)';
      document.body.classList.remove('modal-open');
    }));
    if (overlayRef.current) overlayRef.current.classList.remove('visible');
    setTimeout(() => {
      if (!modalRef.current) return;
      modalRef.current.style.transform = '';
      modalRef.current.style.height = '';
      modalRef.current.style.transition = '';
      naturalHeightRef.current = 0;
      onClose();
    }, 440);
  }, [onClose]);

  useEffect(() => {
    if (isOpen && modalState === 'closed') {
      if (!modalRef.current) return;
      setModalState('open');
      setNoTransition();
      modalRef.current.style.height = 'auto';
      modalRef.current.style.transform = 'translateY(100%)';
      if (overlayRef.current) overlayRef.current.classList.add('visible');
      document.body.classList.add('modal-open');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!modalRef.current) return;
        naturalHeightRef.current = modalRef.current.offsetHeight;
        setTransition(['transform']);
        modalRef.current.style.transform = 'translateY(0)';
        modalRef.current.style.height = naturalHeightRef.current + 'px';
      }));
    } else if (!isOpen && modalState !== 'closed') {
      snapToClosed();
    }
  }, [isOpen, modalState, snapToClosed]);

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartYRef.current = e.clientY;
    dragLastYRef.current = e.clientY;
    velRef.current = 0; dragDYRef.current = 0;
    lastTimeRef.current = Date.now();
    isCapturingRef.current = true;
    setNoTransition();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isCapturingRef.current) return;
    const now = Date.now();
    const dt = now - lastTimeRef.current;
    if (dt > 0) velRef.current = (e.clientY - dragLastYRef.current) / dt * 1000;
    dragLastYRef.current = e.clientY;
    lastTimeRef.current = now;
    const dy = e.clientY - dragStartYRef.current;
    dragDYRef.current = dy;
    if (!modalRef.current) return;
    if (modalState === 'expanded') {
      if (dy > 0) modalRef.current.style.height = Math.max(naturalHeightRef.current, expandedHeight() - dy) + 'px';
    } else {
      if (dy > 0) modalRef.current.style.transform = `translateY(${dy}px)`;
      else { modalRef.current.style.height = Math.min(expandedHeight(), naturalHeightRef.current + Math.abs(dy)) + 'px'; modalRef.current.style.transform = 'translateY(0)'; }
    }
  };

  const handlePointerUp = () => {
    if (!isCapturingRef.current) return;
    isCapturingRef.current = false;
    const dy = dragDYRef.current;
    const vel = velRef.current;
    if (dy > 80 || vel > 400) { if (modalState === 'expanded') snapToOpen(); else snapToClosed(); }
    else if (dy < -60 || vel < -400) snapToExpanded();
    else { if (modalState === 'expanded') snapToExpanded(); else snapToOpen(); }
    dragDYRef.current = 0;
  };

  // Group by date
  const groups: Record<string, DrinkEntry[]> = {};
  [...entries].reverse().forEach(e => {
    if (!groups[e.date]) groups[e.date] = [];
    groups[e.date].push(e);
  });

  return (
    <div className="appoverlay" id="ds-historyOverlay" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) snapToClosed(); }}>
      <div className="modal" id="ds-historyModal" ref={modalRef}>
        <div
          className="modal-handle-zone"
          id="ds-historyHandleZone"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="modal-handle" />
        </div>
        <div className="modal-header">
          <div className="modal-title">History</div>
        </div>
        <div className="modal-body" id="ds-historyList">
            {Object.keys(groups).length === 0
              ? <div className="empty-state"><div className="empty-icon"><i className="fa-solid fa-bottle-water" /></div>No entries yet.</div>
              : Object.entries(groups).map(([date, dayEntries]) => {
                  const totalMl = dayEntries.reduce((s, e) => s + e.amount, 0);
                  return (
                    <React.Fragment key={date}>
                      <div className="log-date-header">
                        {formatDateLabel(date)} <span className="log-date-total">{fmtMl(totalMl)}</span>
                      </div>
                      {dayEntries.map(e => (
                        <div key={e.id} className="log-item no-anim">
                          <div className="log-emoji no-select"><i className={e.emoji} /></div>
                          <div className="log-info">
                            <div className="log-name">{e.drink}</div>
                            <div className="log-time">{fmtTime(e.ts)}</div>
                          </div>
                          <div className="log-amount">+{e.amount} ml</div>
                        </div>
                      ))}
                    </React.Fragment>
                  );
                })
            }
        </div>
      </div>
    </div>
  );
}
