'use client';

import { useEffect, useState } from 'react';

const LOG_TIMEOUT = 1387;
const SPLASH_KEY = 'calsync_splash_enabled';

export default function SplashScreen() {
    const [enabled, setEnabled] = useState(false);
    const [visible, setVisible] = useState(true);
    const [hiding, setHiding] = useState(false);

    useEffect(() => {
        if (localStorage.getItem(SPLASH_KEY) !== 'true') {
            setVisible(false);
            return;
        }
        setEnabled(true);
        const t1 = setTimeout(() => setHiding(true), LOG_TIMEOUT);
        const t2 = setTimeout(() => setVisible(false), LOG_TIMEOUT + 300);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, []);

    if (!enabled || !visible) return null;

    return (
        <div id="splashScreen" className={`splash-screen${hiding ? ' SplashHidden' : ''}`}>
            <div className="splash-logo">
                <img src="/favicon.png" alt="HealthSync" />
            </div>
        </div>
    );
}
