'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../../_context/AuthContext';

export default function Toast() {
    const { toastQueue, consumeToast } = useAuth();
    const [visible, setVisible] = useState(false);
    const [current, setCurrent] = useState<{ msg: string; cls?: string } | null>(null);

    useEffect(() => {
        if (toastQueue.length === 0) return;
        const item = toastQueue[0];
        setCurrent({ msg: item.msg, cls: item.cls });
        setVisible(true);
        const t = setTimeout(() => {
            setVisible(false);
            setTimeout(() => {
                setCurrent(null);
                consumeToast();
            }, 300);
        }, item.duration || 2500);
        return () => clearTimeout(t);
    }, [toastQueue, consumeToast]);

    if (!current) return (
        <div id="toast" className="toast" style={{ padding: "0 !important", visibility: "hidden" }} />
    );

    const longestLine = Math.max(...current.msg.split('\n').map(line => line.length));
    const toastWidth = Math.min(480, Math.max(160, longestLine * 7.2 + 32));

    return (
        <div id="toast" role="status" aria-live="polite" className={`toast${visible ? ' show' : ''}${current.cls ? ' ' + current.cls : ''}`} style={{ width: toastWidth }}>
            {current.msg}
        </div>
    );
}
