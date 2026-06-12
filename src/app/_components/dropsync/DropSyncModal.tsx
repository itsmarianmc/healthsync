'use client';

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
import type { DrinkEntry } from '../../_lib/types';
import DrinkPicker, { type DrinkOption } from './DrinkPicker';
import GlassInput from './GlassInput';

interface DropSyncModalProps {
  onClose: () => void;
  onAddEntry: (entry: DrinkEntry) => void;
  isOpen: boolean;
}

const SHEET_TOP_MARGIN = 24;
const EASE = 'cubic-bezier(0.34, 1.15, 0.64, 1)';

export default function DropSyncModal({ onClose, onAddEntry, isOpen }: DropSyncModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedDrink, setSelectedDrink] = useState<DrinkOption | null>(null);
  const [amount, setAmount] = useState(250);
  const [modalState, setModalState] = useState<'closed' | 'open' | 'expanded'>('closed');
  const isClosingRef = useRef(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const bodyHRef = useRef(0);
  const naturalHeightRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragDYRef = useRef(0);
  const velRef = useRef(0);
  const lastTimeRef = useRef(0);
  const dragLastYRef = useRef(0);
  const isCapturingRef = useRef(false);

  const expandedHeight = () => window.innerHeight - SHEET_TOP_MARGIN;

  const setNoTransition = () => { if (modalRef.current) modalRef.current.style.transition = 'none'; };
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
    if (bodyRef.current && bodyHRef.current > 0) { bodyRef.current.style.height = bodyHRef.current + 'px'; }
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
    if (!modalRef.current || isClosingRef.current) return;
    isClosingRef.current = true;
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
      isClosingRef.current = false;
      setStep(1);
      setSelectedDrink(null);
      setAmount(250);
      onClose();
    }, 440);
  }, [onClose]);

  useLayoutEffect(() => {
    return () => {
      setModalState('closed');
    };
  }, []);

  useEffect(() => {
    if (isOpen && modalState === 'closed' && !isClosingRef.current) {
      setStep(1);
      setSelectedDrink(null);
      setAmount(250);
      if (!modalRef.current) return;
      setModalState('open');
      setNoTransition();
      modalRef.current.style.height = 'auto';
      modalRef.current.style.transform = 'translateY(100%)';
      if (overlayRef.current) overlayRef.current.classList.add('visible');
      document.body.classList.add('modal-open');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!modalRef.current || !bodyRef.current || !step1Ref.current) return;
        bodyRef.current.style.overflow = 'hidden';
        const initBodyH = step1Ref.current.offsetHeight;
        bodyHRef.current = initBodyH;
        bodyRef.current.style.height = initBodyH + 'px';
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
    velRef.current = 0;
    dragDYRef.current = 0;
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
      if (dy > 0) {
        const newH = Math.max(naturalHeightRef.current, expandedHeight() - dy);
        modalRef.current.style.height = newH + 'px';
      }
    } else {
      if (dy > 0) {
        modalRef.current.style.transform = `translateY(${dy}px)`;
      } else {
        const newH = Math.min(expandedHeight(), naturalHeightRef.current + Math.abs(dy));
        modalRef.current.style.height = newH + 'px';
        modalRef.current.style.transform = 'translateY(0)';
      }
    }
  };

  const handlePointerUp = () => {
    if (!isCapturingRef.current) return;
    isCapturingRef.current = false;
    const dy = dragDYRef.current;
    const vel = velRef.current;
    if (dy > 80 || vel > 400) {
      if (modalState === 'expanded') snapToOpen();
      else snapToClosed();
    } else if (dy < -60 || vel < -400) {
      snapToExpanded();
    } else {
      if (modalState === 'expanded') snapToExpanded();
      else snapToOpen();
    }
    dragDYRef.current = 0;
  };

  useEffect(() => {
    if (modalState !== 'open' || !modalRef.current || !bodyRef.current || naturalHeightRef.current === 0) return;
    const el = step === 1 ? step1Ref.current : step2Ref.current;
    if (!el) return;
    const newBodyH = el.offsetHeight;
    if (newBodyH === 0) return;
    bodyHRef.current = newBodyH;
    const fixedH = Math.max(0, naturalHeightRef.current - bodyRef.current.offsetHeight);
    const newTotalH = fixedH + newBodyH;
    naturalHeightRef.current = newTotalH;
    bodyRef.current.style.transition = 'height 0.38s cubic-bezier(0.4,0,0.2,1)';
    bodyRef.current.style.height = newBodyH + 'px';
    modalRef.current.style.transition = 'height 0.38s cubic-bezier(0.4,0,0.2,1)';
    modalRef.current.style.height = newTotalH + 'px';
    setTimeout(() => {
      if (bodyRef.current) bodyRef.current.style.transition = '';
      if (modalRef.current) modalRef.current.style.transition = '';
    }, 400);
  }, [step, selectedDrink]);

  const handleSelectDrink = (drink: DrinkOption) => {
    setSelectedDrink(drink);
    setStep(2);
  };

  const handleAddEntry = () => {
    if (!selectedDrink) return;
    const entry: DrinkEntry = {
      id: Date.now().toString(),
      drink: selectedDrink.name,
      emoji: selectedDrink.emoji,
      color: selectedDrink.color,
      amount,
      ts: Date.now(),
      date: new Date().toDateString(),
      source: 'dropsync',
    };
    onAddEntry(entry);
    snapToClosed();
  };

  const handleBack = () => {
    setStep(1);
    setSelectedDrink(null);
  };

  const SVG_ARROW = <svg height="25" viewBox="0 -960 960 960" width="25" fill="#ffffff"><path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z"/></svg>;
  const SVG_CHECK = <svg height="25" viewBox="0 -960 960 960" width="25" fill="#ffffff"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>;

  return (
    <div
      className="appoverlay"
      id="ds-addOverlay"
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) snapToClosed(); }}
    >
      <div className="modal" id="ds-modal" ref={modalRef}>
        <div
          className="modal-handle-zone"
          id="ds-handleZone"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="modal-handle" />
        </div>
        <div className="modal-header">
          <div className="modal-btn">
            <button
              className={`back-btn${step === 1 ? ' hidden' : ''}`}
              id="ds-backBtn"
              style={{ opacity: step === 2 ? 1 : 0 }}
              onClick={handleBack}
            >
              <svg height="18" viewBox="0 -960 960 960" width="18" fill="currentColor"><path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z"/></svg>
            </button>
          </div>
          <div className="modal-title" id="ds-modalTitle">
            {step === 1 ? 'What did you drink?' : selectedDrink?.name || 'Amount'}
          </div>
        </div>
        <div className="modal-body" id="ds-modalBody" ref={bodyRef} style={{ overflow: 'hidden' }}>
          <div style={{ display: 'flex', width: '200%', alignItems: 'flex-start', transform: `translateX(${step === 1 ? '0' : '-50%'})`, transition: 'transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)' }}>
            <div ref={step1Ref} style={{ display: 'block', width: '50%', flexShrink: 0 }}>
              <DrinkPicker selected={selectedDrink} onSelect={handleSelectDrink} />
            </div>
            <div ref={step2Ref} style={{ display: 'block', width: '50%', flexShrink: 0 }}>
              {selectedDrink && <GlassInput amount={amount} onChange={setAmount} drinkColor={selectedDrink.color} />}
            </div>
          </div>
        </div>
        <div className="modal-footer" id="ds-modalFooter">
          <button
            id="ds-actionBtn"
            className="confirm-btn"
            disabled={step === 1 && !selectedDrink}
            onClick={step === 1 ? () => selectedDrink && handleSelectDrink(selectedDrink) : handleAddEntry}
          >
            <span id="ds-actionIcon">{step === 1 ? SVG_ARROW : SVG_CHECK}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
