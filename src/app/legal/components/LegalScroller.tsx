'use client';

import { useEffect } from 'react';

export default function LegalScroller() {
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
                return;
            }
            const target = e.target as HTMLElement | null;
            const host = target?.closest<HTMLElement>('[data-scroll-to-id]');
            if (!host) return;

            const id = host.dataset.scrollToId;
            if (!id) return;

            const dest = document.getElementById(id);
            if (!dest) return;

            e.preventDefault();
            e.stopPropagation();

            dest.scrollIntoView({ behavior: 'smooth', block: 'start' });

            if (typeof window !== 'undefined' && window.history?.replaceState) {
                window.history.replaceState(null, '', `#${id}`);
            }
        };

        document.addEventListener('click', onClick, true);
        return () => document.removeEventListener('click', onClick, true);
    }, []);

    return null;
}
