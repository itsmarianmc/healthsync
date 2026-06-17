'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

type LinkOutType = 'internal' | 'external';

interface LinkOutProps {
    item: string;
    target?: '_blank' | '_self';
    type: LinkOutType;
    className?: string;
    children: React.ReactNode;
}

export default function LinkOut({
    item,
    target = '_blank',
    type,
    className,
    children,
}: LinkOutProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);          // Steuert inhaltlich den geöffneten Zustand
    const [showPortal, setShowPortal] = useState(false); // Ob das Portal im DOM existiert
    const [animateIn, setAnimateIn] = useState(false);   // Ob die open-Klasse gesetzt ist
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
        e.preventDefault();

        if (type === 'internal') {
            router.push(item);
            return;
        }

        // Portal erstellen (noch ohne open-Klasse)
        setShowPortal(true);
        setOpen(true);

        // Kurze Verzögerung, damit das Element in den DOM kommt, dann open-Klasse hinzufügen
        setTimeout(() => {
            setAnimateIn(true);
        }, 10);
    }

    function closeAndCleanup(callback?: () => void) {
        setOpen(false);
        setAnimateIn(false);

        // Nach Ende der CSS‑Transition (0.25s) das Portal aus dem DOM entfernen
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setShowPortal(false);
            if (callback) callback();
        }, 300);
    }

    function handleContinue() {
        closeAndCleanup(() => {
            window.open(item, target, 'noopener,noreferrer');
        });
    }

    function handleBack() {
        closeAndCleanup();
    }

    function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
        if ((e.target as HTMLElement).id === 'linkout-overlay') {
            closeAndCleanup();
        }
    }

    // Timer beim Unmount bereinigen
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    // Link immer rendern, Portal nur wenn nötig
    return (
        <>
            <a
                href={item}
                onClick={handleClick}
                className={className}
                rel={type === 'external' ? 'noopener noreferrer' : undefined}
            >
                {children}
            </a>

            {type === 'external' && showPortal && createPortal(
                <div
                    id="linkout-overlay"
                    className={`linkout-overlay${animateIn ? ' open' : ''}`}
                    onClick={handleOverlayClick}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="linkout-title"
                    aria-describedby="linkout-desc"
                >
                    <div id="linkout-popup" className="linkout-popup">
                        <div className="linkout-popup-header">
                            <span className="linkout-popup-icon" aria-hidden="true">
                                <i className="fas fa-exclamation-triangle"></i>
                            </span>
                            <h3 id="linkout-title" className="linkout-popup-title">
                                You are about to leave itsmarian.dev
                            </h3>
                        </div>
                        <p id="linkout-desc" className="linkout-popup-text">
                            You are about to leave the services from itsmarian and visit an external
                            website that is not operated or verified by itsmarian. Itsmarian is not
                            responsible for the content, privacy practices, or safety of this site.
                        </p>
                        <div className="linkout-popup-url" title={item}>
                            {item}
                        </div>
                        <div className="linkout-popup-actions">
                            <button
                                className="linkout-btn-continue"
                                onClick={handleContinue}
                                autoFocus
                            >
                                Continue
                            </button>
                            <button className="linkout-btn-back" onClick={handleBack}>
                                Go Back
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}