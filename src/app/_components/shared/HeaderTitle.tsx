'use client';

import { useEffect, useState } from 'react';

const DISPLAY_KEY = 'calsync_display_name';
const NAME_KEY = 'calsync_first_name';

function read() {
    if (typeof window === 'undefined') return { enabled: false, name: '' };
    return {
        enabled: localStorage.getItem(DISPLAY_KEY) === 'true',
        name: (localStorage.getItem(NAME_KEY) || '').trim(),
    };
}

export default function HeaderTitle() {
    const [{ enabled, name }, setState] = useState({ enabled: false, name: '' });

    useEffect(() => {
        setState(read());
        const sync = () => setState(read());
        window.addEventListener('storage', sync);
        return () => window.removeEventListener('storage', sync);
    }, []);

    if (enabled && name) {
        return (
            <div className="header-title">
                Hi,&nbsp;<span>{name}</span>
            </div>
        );
    }

    return (
        <div className="header-title">
            Health<span>Sync</span>
        </div>
    );
}
