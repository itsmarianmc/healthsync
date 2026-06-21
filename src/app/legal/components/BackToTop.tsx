'use client';
import { useEffect, useState } from 'react';
import '@/app/legal/legal.css';

export default function BackToTop() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const toggle = () => setVisible(window.scrollY > 100);
        toggle();
        window.addEventListener('scroll', toggle, { passive: true });
        return () => window.removeEventListener('scroll', toggle);
    }, []);

    return (
        <div
            className="btt-btn"
            style={{ display: visible ? 'block' : 'none' }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="btt-button">
                <svg xmlns="http://www.w3.org/2000/svg" height="40" viewBox="0 -960 960 960" width="40" fill="#fff">
                    <path d="M440-160v-487L216-423l-56-57 320-320 320 320-56 57-224-224v487h-80Z" />
                </svg>
                <span className="btt-text">Back to top</span>
            </div>
        </div>
    );
}
