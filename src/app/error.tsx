'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="error-boundary">
            <div className="error-boundary-card">
                <div className="error-boundary-icon">
                    <i className="fa-solid fa-triangle-exclamation" />
                </div>
                <div className="error-boundary-title">Something went wrong</div>
                <div className="error-boundary-text">
                    An unexpected error occurred. Try again or reload the page.
                </div>
                <button className="btn--primary" onClick={() => reset()}>
                    Try again
                </button>
            </div>
        </div>
    );
}