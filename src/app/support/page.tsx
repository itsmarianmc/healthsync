'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/_context/AuthContext';
import HeaderTitle from '@/app/_components/shared/HeaderTitle';
import { APP_VERSION } from '@/app/_lib/release';

type SupportReason =
    | 'bug'
    | 'improvement'
    | 'feature'
    | 'question'
    | 'other';

const REASON_LABELS: Record<SupportReason, string> = {
    bug: 'Bug Report',
    improvement: 'Improvement Suggestion',
    feature: 'Feature Request',
    question: 'Question',
    other: 'Other',
};

const REASON_COLORS: Record<SupportReason, string> = {
    bug: '#FF453A',
    improvement: '#FFD60A',
    feature: '#30D158',
    question: '#5AC8FA',
    other: '#8E8E93',
};

const REASON_DESCRIPTIONS: Record<SupportReason, string> = {
    bug: 'Something isn\'t working as expected.',
    improvement: 'I have an idea to make something better.',
    feature: 'I\'d like to request a new feature.',
    question: 'I have a question about the app.',
    other: 'Something else.',
};

export default function SupportPage() {
    const router = useRouter();
    const { user, showToast } = useAuth();

    const [reason, setReason] = useState<SupportReason>('bug');
    const [description, setDescription] = useState('');
    const [email, setEmail] = useState(user?.email || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();

            if (!description.trim()) {
                showToast('Please describe your issue or suggestion.', 3000);
                return;
            }

            setIsSubmitting(true);

            try {
                const response = await fetch('https://api.itsmarian.dev/api/healthsync/support', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        reason,
                        description: description.trim(),
                        email: email.trim() || undefined,
                        userId: user?.id,
                        userEmail: user?.email,
                        appVersion: APP_VERSION,
                        timestamp: new Date().toISOString(),
                        userAgent: navigator.userAgent,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Failed to send support request');
                }

                setIsSuccess(true);
                showToast('Support request sent successfully!', 3000);
                setTimeout(() => router.push('/dash'), 2000);
            } catch (error) {
                console.error('Support submission error:', error);
                showToast(
                    error instanceof Error ? error.message : 'Failed to send. Please try again.',
                    4000
                );
            } finally {
                setIsSubmitting(false);
            }
        },
        [reason, description, email, user, router, showToast]
    );

    return (
        <div
            className="app-view active"
            style={{
                maxWidth: '420px',
                margin: '0 auto',
                padding: '20px 24px 100px', /* fallback */
                paddingTop: '20px',
                paddingBottom: '100px',
            }}
            id='dashboard-view'
        >
            <div className="header" style={{ paddingBottom: '20px' }}>
                <div className="header-title-row">
                    <HeaderTitle />
                    <button
                        className="back-btn"
                        onClick={() => router.back()}
                        style={{ background: 'var(--surface2)' }}
                    >
                        <svg height="18" viewBox="0 -960 960 960" width="18" fill="currentColor">
                            <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
                        </svg>
                        Back
                    </button>
                </div>
                <div className="header-greeting" style={{ marginTop: 4 }}>
                    Support
                </div>
            </div>

            {isSuccess ? (
                <div
                    className="dashboard-hero"
                    style={{ flexDirection: 'column', textAlign: 'center', gap: 12 }}
                >
                    <div style={{ fontSize: 48 }}>✅</div>
                    <h2 style={{ fontSize: 22, fontWeight: 700 }}>Thank you!</h2>
                    <p style={{ color: 'var(--text2)', fontSize: 14, maxWidth: 300 }}>
                        Your support request has been sent. We'll get back to you as soon as
                        possible.
                    </p>
                    <button
                        className="dashboard-action-btn"
                        onClick={() => router.push('/dash')}
                        style={{ background: 'var(--accent)', marginTop: 8 }}
                    >
                        Return to Dashboard
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    <div className="settings-section" style={{ margin: 0 }}>
                        <div className="settings-section-title">
                            <i className="fa-regular fa-comment" />
                            Select Reason
                        </div>
                        <div className="settings-section-body" style={{ padding: '12px 16px' }}>
                            <select
                                className="form-input"
                                value={reason}
                                onChange={(e) => setReason(e.target.value as SupportReason)}
                                style={{ appearance: 'auto', padding: '10px 14px' }}
                            >
                                {Object.entries(REASON_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                            <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 6 }}>
                                {REASON_DESCRIPTIONS[reason]}
                            </p>
                        </div>
                    </div>

                    <div className="settings-section" style={{ margin: 0 }}>
                        <div className="settings-section-title">
                            <i className="fa-regular fa-pen-to-square" />
                            Description
                        </div>
                        <div className="settings-section-body" style={{ padding: '12px 16px' }}>
                            <textarea
                                className="ai-text-input"
                                placeholder="Please describe your issue, suggestion, or question in detail…"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={5}
                                required
                                style={{
                                    background: 'var(--surface3)',
                                    border: '1.5px solid var(--border)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text)',
                                    fontFamily: 'inherit',
                                    fontSize: 16,
                                    maxHeight: 333,
                                    padding: '12px 14px',
                                    resize: 'vertical',
                                    width: '100%',
                                }}
                            />
                            <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 6 }}>
                                {description.length}/500 characters
                            </p>
                        </div>
                    </div>

                    <div className="settings-section" style={{ margin: 0 }}>
                        <div className="settings-section-title">
                            <i className="fa-regular fa-envelope" />
                            Contact (optional)
                        </div>
                        <div className="settings-section-body" style={{ padding: '12px 16px' }}>
                            <input
                                type="email"
                                className="form-input"
                                placeholder="Your email address (for follow-up)"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    background: 'var(--surface3)',
                                    border: '1.5px solid var(--border)',
                                }}
                                autoComplete="email"
                                autoCapitalize="none"
                                autoCorrect="off"
                            />
                            <p style={{ color: 'var(--text3)', fontSize: 12, marginTop: 6 }}>
                                If you're logged in, your email is pre-filled. You can change it.
                            </p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="confirm-btn"
                        disabled={isSubmitting}
                        style={{
                            background: isSubmitting ? 'var(--surface3)' : 'var(--accent)',
                            cursor: isSubmitting ? 'not-allowed' : 'pointer',
                            opacity: isSubmitting ? 0.6 : 1,
                        }}
                    >
                        {isSubmitting ? (
                            <>
                                <i
                                    className="fa-solid fa-spinner fa-spin"
                                    style={{ marginRight: 8 }}
                                />
                                Sending…
                            </>
                        ) : (
                            'Send Support Request'
                        )}
                    </button>

                    <div
                        style={{
                            textAlign: 'center',
                            color: 'var(--text3)',
                            fontSize: 12,
                            marginTop: 4,
                        }}
                    >
                        <i className="fa-regular fa-lock" style={{ marginRight: 4 }} />
                        Your data is transmitted securely.
                    </div>
                </form>
            )}
        </div>
    );
}
