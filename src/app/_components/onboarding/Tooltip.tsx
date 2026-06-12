'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TooltipPayload {
    elementId: string;
    message: string;
    progress: string;
    buttonText: string;
    onNext?: () => void;
}

interface TooltipState extends TooltipPayload {
    targetRect: DOMRect;
}

interface ArrowStyle {
    bottom?: string;
    top?: string;
    left: string;
    borderWidth: string;
    borderColor: string;
}

interface BoxPosition {
    top: number;
    left: number;
    positionedAbove: boolean;
}

const ARROW_SIZE = 12;
const GAP = 16;
const H_PADDING = 20;
const BOX_MAX_WIDTH = 260;
const ANIMATION_DURATION = 300;

function calcPosition(
        targetRect: DOMRect,
        tooltipWidth: number,
        tooltipHeight: number,
    ): BoxPosition {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const spaceAbove = targetRect.top;
    const spaceBelow = vh - targetRect.bottom;
    const needed = tooltipHeight + GAP + ARROW_SIZE;

    let positionedAbove = spaceAbove > spaceBelow;
    if (positionedAbove && spaceAbove < needed && spaceBelow >= needed) {
        positionedAbove = false;
    }

    let left =
        targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
    left = Math.max(H_PADDING, Math.min(left, vw - tooltipWidth - H_PADDING));

    const top = positionedAbove
        ? targetRect.top - tooltipHeight - GAP - ARROW_SIZE
        : targetRect.bottom + GAP + ARROW_SIZE;

    return { top, left, positionedAbove };
}

function calcArrowStyle(
        targetRect: DOMRect,
        boxLeft: number,
        positionedAbove: boolean,
    ): ArrowStyle {
    const arrowLeft = targetRect.left + targetRect.width / 2 - boxLeft - ARROW_SIZE;

    if (positionedAbove) {
        return {
        bottom: `-${ARROW_SIZE}px`,
        left: `${arrowLeft}px`,
        borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px 0 ${ARROW_SIZE}px`,
        borderColor: 'var(--surface) transparent transparent transparent',
        };
    }
    return {
        top: `-${ARROW_SIZE}px`,
        left: `${arrowLeft}px`,
        borderWidth: `0 ${ARROW_SIZE}px ${ARROW_SIZE}px ${ARROW_SIZE}px`,
        borderColor: 'transparent transparent var(--surface) transparent',
    };
}

export default function Tooltip() {
    const [state, setState] = useState<TooltipState | null>(null);
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState<BoxPosition | null>(null);
    const [arrowStyle, setArrowStyle] = useState<ArrowStyle | null>(null);

    const boxRef = useRef<HTMLDivElement>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const elevatedRef = useRef<{ el: HTMLElement; originalZ: string } | null>(null);

    const elevateTarget = useCallback((el: HTMLElement) => {
        elevatedRef.current = {
        el,
        originalZ: el.style.zIndex ?? '',
        };
        el.style.position = 'relative';
        el.style.zIndex = '10000';
    }, []);

    const restoreTarget = useCallback(() => {
        if (!elevatedRef.current) return;
        const { el, originalZ } = elevatedRef.current;
        el.style.zIndex = originalZ;
        elevatedRef.current = null;
    }, []);

    const open = useCallback(
        (payload: TooltipPayload) => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }

        restoreTarget();

        const target = document.getElementById(payload.elementId);
        if (!target) {
            payload.onNext?.();
            return;
        }

        const targetRect = target.getBoundingClientRect();
        elevateTarget(target);

        setState({ ...payload, targetRect });
        setVisible(false); 
        },
        [elevateTarget, restoreTarget],
    );

    const close = useCallback(() => {
        setVisible(false);
        closeTimerRef.current = setTimeout(() => {
        setState(null);
        setPosition(null);
        setArrowStyle(null);
        restoreTarget();
        closeTimerRef.current = null;
        }, ANIMATION_DURATION);
    }, [restoreTarget]);

    const reposition = useCallback(() => {
        if (!state || !boxRef.current) return;
        const { width, height } = boxRef.current.getBoundingClientRect();
        const pos = calcPosition(state.targetRect, width, height);
        setPosition(pos);
        setArrowStyle(calcArrowStyle(state.targetRect, pos.left, pos.positionedAbove));
    }, [state]);

    useEffect(() => {
        if (!state) return;

        const raf = requestAnimationFrame(() => {
        reposition();
        requestAnimationFrame(() => setVisible(true));
        });

        return () => cancelAnimationFrame(raf);
    }, [state, reposition]);

    useEffect(() => {
        if (!state) return;
        window.addEventListener('resize', reposition);
        return () => window.removeEventListener('resize', reposition);
    }, [state, reposition]);

    useEffect(() => {
        const handleShow = (e: Event) => {
        const detail = (e as CustomEvent<TooltipPayload>).detail;
        open(detail);
        };

        window.addEventListener('__showTooltip', handleShow);
        return () => window.removeEventListener('__showTooltip', handleShow);
    }, [open]);

    useEffect(() => {
        (window as Window & { showToolTip?: unknown; closeToolTip?: unknown }).showToolTip = (
        elementId: string,
        message: string,
        progress: string,
        buttonText: string,
        buttonAction?: (() => void) | string,
        ) => {
        open({
            elementId,
            message,
            progress,
            buttonText,
            onNext:
            typeof buttonAction === 'function'
                ? buttonAction
                : typeof buttonAction === 'string'
                ? () => {
                    try {
                    (window as unknown as Record<string, () => void>)[buttonAction]?.();
                    } catch (e) {
                    console.error('Tooltip button action error:', e);
                    }
                }
                : undefined,
        });
        };

        (window as Window & { closeToolTip?: unknown }).closeToolTip = close;

        return () => {
        delete (window as unknown as Record<string, unknown>).showToolTip;
        delete (window as unknown as Record<string, unknown>).closeToolTip;
        };
    }, [open, close]);

    useEffect(() => {
        return () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
        restoreTarget();
        };
    }, [restoreTarget]);

    if (!state || typeof document === 'undefined') return null;

    const handleButton = () => {
        const cb = state.onNext;
        close();
        if (cb) {
        setTimeout(cb, ANIMATION_DURATION);
        }
    };

    const overlayStyle: React.CSSProperties = {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 9997,
        opacity: visible ? 1 : 0,
        transition: `opacity ${ANIMATION_DURATION}ms var(--ease, ease)`,
    };

    const boxStyle: React.CSSProperties = {
        position: 'fixed',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '20px',
        maxWidth: `${BOX_MAX_WIDTH}px`,
        width: `calc(100% - ${H_PADDING * 4}px)`,
        boxShadow: 'var(--shadow)',
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.9)',
        transition: `opacity ${ANIMATION_DURATION}ms var(--ease, ease), transform ${ANIMATION_DURATION}ms var(--ease, ease)`,
        top: position ? `${position.top}px` : '-9999px',
        left: position ? `${position.left}px` : '-9999px',
    };

    const arrowBaseStyle: React.CSSProperties = {
        position: 'absolute',
        width: 0,
        height: 0,
        borderStyle: 'solid',
        ...(arrowStyle ?? {}),
    };

    return createPortal(
        <>
        <div
            style={overlayStyle}
            aria-hidden="true"
            onClick={close}
        />
            <div
                ref={boxRef}
                role="tooltip"
                aria-live="polite"
                style={boxStyle}
                >
                <div
                    style={{
                        color: 'var(--text)',
                        fontSize: '15px',
                        lineHeight: 1.5,
                        marginBottom: '5px',
                    }}
                    dangerouslySetInnerHTML={{ __html: state.message }}
                />

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                <span
                    style={{
                    color: 'var(--accent)',
                    fontSize: '7.5px',
                    }}
                    >
                    {state.progress}
                </span>

                <button
                    style={{
                        color: 'var(--accent)',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'transparent',
                        padding: '6px',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: `opacity ${ANIMATION_DURATION}ms var(--ease, ease)`,
                    }}
                    onMouseDown={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.7')}
                    onMouseUp={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
                    onClick={handleButton}
                    >
                    {state.buttonText}
                </button>
            </div>

            {arrowStyle && <div style={arrowBaseStyle} aria-hidden="true" />}
        </div>
        </>,
        document.body,
    );
}