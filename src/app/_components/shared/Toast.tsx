'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '../../_context/AuthContext';

type ToastItem = {
    id: number;
    msg: string;
    duration: number;
    cls?: string;
    undo?: (() => void) | null;
};

const MIN_VISIBLE_MS = 2000;
const EXIT_MS = 300;
const MESSAGE_TRANSITION_MS = 240;

function ActiveToast({ item, consumeToast }: { item: ToastItem; consumeToast: () => void }) {
    const [visible, setVisible] = useState(false);
    const [visibleSince, setVisibleSince] = useState<number | null>(null);
    const [visibleMessage, setVisibleMessage] = useState(item.msg);
    const [incomingMessage, setIncomingMessage] = useState<string | null>(null);
    const [isMessageChanging, setIsMessageChanging] = useState(false);
    const [toastWidth, setToastWidth] = useState<number | undefined>();
    const visibleMessageRef = useRef<HTMLSpanElement>(null);
    const incomingMessageRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const repeatsVisibleMessage = item.msg === visibleMessageRef.current?.textContent && incomingMessageRef.current === null;
        const showFrame = requestAnimationFrame(() => {
            setVisible(true);
            setVisibleSince(since => repeatsVisibleMessage ? Date.now() : since ?? Date.now());
        });
        return () => cancelAnimationFrame(showFrame);
    }, [item]);

    useEffect(() => {
        if (visibleSince === null || incomingMessage !== null || item.msg === visibleMessage) return;
        const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - visibleSince));
        const timer = setTimeout(() => setIncomingMessage(item.msg), remaining);
        return () => clearTimeout(timer);
    }, [item.msg, visibleMessage, incomingMessage, visibleSince]);

    useEffect(() => {
        if (visibleSince === null || incomingMessage !== null || item.msg !== visibleMessage) return;
        const duration = Math.max(MIN_VISIBLE_MS, item.duration || 2500);
        const remaining = Math.max(0, duration - (Date.now() - visibleSince));
        const hideTimer = setTimeout(() => setVisible(false), remaining);
        const removeTimer = setTimeout(consumeToast, remaining + EXIT_MS);
        return () => {
            clearTimeout(hideTimer);
            clearTimeout(removeTimer);
        };
    }, [item, visibleMessage, incomingMessage, visibleSince, consumeToast]);

    useLayoutEffect(() => {
        const message = incomingMessageRef.current || visibleMessageRef.current;
        if (!message) return;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;
        context.font = window.getComputedStyle(message).font;
        const textWidth = context.measureText(message.textContent || '').width;
        const width = Math.min(480, window.innerWidth - 32, Math.ceil(textWidth) + (item.undo ? 108 : 34));
        setToastWidth(width);
    }, [visibleMessage, incomingMessage, item.undo]);

    useEffect(() => {
        if (incomingMessage === null) return;

        // Render both messages at their starting positions before sliding them.
        let finishTimer: ReturnType<typeof setTimeout> | undefined;
        let secondFrame: number | undefined;
        const firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => {
                setIsMessageChanging(true);
                finishTimer = setTimeout(() => {
                    setVisibleMessage(incomingMessage);
                    setVisibleSince(Date.now());
                    setIncomingMessage(null);
                    setIsMessageChanging(false);
                }, MESSAGE_TRANSITION_MS);
            });
        });

        return () => {
            cancelAnimationFrame(firstFrame);
            if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
            if (finishTimer !== undefined) clearTimeout(finishTimer);
        };
    }, [incomingMessage]);

    return (
        <div id="toast" role={item.cls === 'toast-error' ? 'alert' : 'status'} aria-live={item.cls === 'toast-error' ? 'assertive' : 'polite'} className={`toast${visible ? ' show' : ''}${item.cls ? ' ' + item.cls : ''}`} style={{ width: toastWidth }}>
            <span className={`toast-message-viewport${isMessageChanging ? ' is-changing' : ''}`}>
                {incomingMessage !== null ? (
                    <>
                        <span ref={visibleMessageRef} className="toast-message toast-message-old" aria-hidden="true">{visibleMessage}</span>
                        <span ref={incomingMessageRef} className="toast-message toast-message-new">{incomingMessage}</span>
                    </>
                ) : (
                    <span ref={visibleMessageRef} className="toast-message">{visibleMessage}</span>
                )}
            </span>
            {item.undo && <button type="button" className="toast-undo" onClick={() => {
                item.undo?.();
                consumeToast();
            }}>Undo</button>}
        </div>
    );
}

export default function Toast() {
    const { toastQueue, consumeToast } = useAuth();
    const item = toastQueue[0];

    if (!item) return <div id="toast" className="toast" style={{ visibility: 'hidden' }} />;
    return <ActiveToast key={item.id} item={item} consumeToast={consumeToast} />;
}
