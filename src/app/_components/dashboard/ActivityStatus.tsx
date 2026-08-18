'use client';

import { JSX, useEffect, useState } from 'react';
import { useAuth } from '../../_context/AuthContext';
import { useCookieConsent } from '../../_lib/useCookieConsent';
import { pushSettings } from '../../_lib/sync';
import { useDraggableSheet } from '../../_hooks/useDraggableSheet';

export type ActivityStatus = 'active' | 'sick' | 'injured' | 'on_a_break';
export type StatusDuration = 'until_changed' | 'until_tomorrow' | '7_days' | '14_days' | 'custom';

export interface ActivityStatusState {
    status: ActivityStatus;
    duration: StatusDuration;
    customStartDate?: Date;
    customEndDate?: Date;
}

type ActivityStatusMeta = {
    label: string;
    description: string;
    color: string;
    icon: (props: { className?: string }) => JSX.Element;
};

const STORAGE_KEY = 'healthsync_activity_status';
const DEFAULT_STATE: ActivityStatusState = {
    status: 'active',
    duration: 'until_changed',
};

function getActivePeriod(state: ActivityStatusState): { start: Date; end: Date } | null {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (state.duration) {
        case 'until_changed':
            return null;
        case 'until_tomorrow':
            return { start: today, end: today };
        case '7_days':
            return { start: today, end: new Date(today.getTime() + 6 * 86400000) };
        case '14_days':
            return { start: today, end: new Date(today.getTime() + 13 * 86400000) };
        case 'custom':
            if (!state.customStartDate || !state.customEndDate) return null;
            const start = new Date(state.customStartDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(state.customEndDate);
            end.setHours(0, 0, 0, 0);
            return { start, end };
        default:
            return null;
    }
}

function isActive(state: ActivityStatusState): boolean {
    const period = getActivePeriod(state);
    if (!period) return true;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return today >= period.start && today <= period.end;
}

function getEffectiveStatus(state: ActivityStatusState): ActivityStatus {
    return isActive(state) ? state.status : 'active';
}

function getSubtitle(state: ActivityStatusState): string {
    const effective = getEffectiveStatus(state);
    if (effective === state.status) {
        return formatDurationLabel(state.duration, state.customStartDate, state.customEndDate);
    } else {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (state.duration === 'custom' && state.customStartDate) {
            const start = new Date(state.customStartDate);
            start.setHours(0, 0, 0, 0);
            if (start > today) {
                return `Until ${formatCustomDate(state.customStartDate)}`;
            } else {
                return 'Expired';
            }
        } else if (
            state.duration === 'until_tomorrow' ||
            state.duration === '7_days' ||
            state.duration === '14_days'
        ) {
            return 'Expired';
        } else {
            return '';
        }
    }
}

function RunningIcon({ className }: { className?: string }) {
    return <i className={`fa-solid fa-person-running ${className || ''}`}></i>;
}

function BedIcon({ className }: { className?: string }) {
    return <i className={`fa-solid fa-bed ${className || ''}`}></i>;
}

function BandageIcon({ className }: { className?: string }) {
    return <i className={`fa-solid fa-bandage ${className || ''}`}></i>;
}

function BreakIcon({ className }: { className?: string }) {
    return <i className={`fa-solid fa-tree-palm ${className || ''}`}></i>;
}

function ChevronDownIcon({ className }: { className?: string }) {
    return <i className={`fa-solid fa-chevron-down ${className || ''}`}></i>;
}

function ChevronRightIcon({ className }: { className?: string }) {
    return <i className={`fa-solid fa-chevron-right ${className || ''}`}></i>;
}

function ClockIcon({ className }: { className?: string }) {
    return <i className={`fa-regular fa-clock ${className || ''}`}></i>;
}

function CalendarIcon({ className }: { className?: string }) {
    return <i className={`fa-regular fa-calendar ${className || ''}`}></i>;
}

function formatCustomDate(date?: Date): string {
    if (!date || Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function formatDurationLabel(
    duration: StatusDuration,
    customStartDate?: Date,
    customEndDate?: Date
): string {
    if (duration === 'until_changed') return 'Until changed';
    if (duration === 'until_tomorrow') return 'Until tomorrow';
    if (duration === '7_days') return '7 days';
    if (duration === '14_days') return '14 days';
    if (customStartDate && customEndDate) {
        return `${formatCustomDate(customStartDate)} - ${formatCustomDate(customEndDate)}`;
    }
    if (customStartDate) return `From ${formatCustomDate(customStartDate)}`;
    if (customEndDate) return `Until ${formatCustomDate(customEndDate)}`;
    return 'Custom Date';
}

function toDateInputValue(date?: Date): string {
    if (!date || Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function fromDateInputValue(value: string): Date | undefined {
    if (!value) return undefined;
    const parsed = new Date(`${value}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function loadSavedState(): ActivityStatusState {
    if (typeof window === 'undefined') return DEFAULT_STATE;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_STATE;
        const parsed = JSON.parse(raw) as Partial<{
            status: ActivityStatus;
            duration: StatusDuration;
            customDate: string;
            customStartDate: string;
            customEndDate: string;
        }>;
        const status =
            parsed.status === 'sick' || parsed.status === 'injured' || parsed.status === 'on_a_break'
                ? parsed.status
                : 'active';
        const duration =
            parsed.duration === 'until_tomorrow' ||
            parsed.duration === '7_days' ||
            parsed.duration === '14_days' ||
            parsed.duration === 'custom'
                ? parsed.duration
                : 'until_changed';
        const customStartDate = parsed.customStartDate
            ? fromDateInputValue(parsed.customStartDate.slice(0, 10))
            : parsed.customDate
              ? fromDateInputValue(parsed.customDate.slice(0, 10))
              : undefined;
        const customEndDate = parsed.customEndDate
            ? fromDateInputValue(parsed.customEndDate.slice(0, 10))
            : parsed.customDate
              ? fromDateInputValue(parsed.customDate.slice(0, 10))
              : undefined;
        return { status, duration, customStartDate, customEndDate };
    } catch {
        return DEFAULT_STATE;
    }
}

function saveState(state: ActivityStatusState) {
    const payload = {
        status: state.status,
        duration: state.duration,
        customStartDate: state.customStartDate ? state.customStartDate.toISOString() : null,
        customEndDate: state.customEndDate ? state.customEndDate.toISOString() : null,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event('storage'));
}

const STATUS_META: Record<ActivityStatus, ActivityStatusMeta> = {
    active: {
        label: 'Active',
        description: 'Staying engaged and healthy',
        color: '#22c55e',
        icon: RunningIcon,
    },
    sick: {
        label: 'Sick',
        description: 'Resting from illness',
        color: '#f59e0b',
        icon: BedIcon,
    },
    injured: {
        label: 'Injured',
        description: 'Recovering from an injury',
        color: '#ef4444',
        icon: BandageIcon,
    },
    on_a_break: {
        label: 'On A Break',
        description: 'Taking time off from training',
        color: '#38bdf8',
        icon: BreakIcon,
    },
};

const STATUS_ORDER: ActivityStatus[] = ['active', 'sick', 'injured', 'on_a_break'];

const DURATION_OPTIONS: Array<{ value: StatusDuration; label: string; icon?: typeof CalendarIcon }> = [
    { value: 'until_changed', label: 'Until changed' },
    { value: 'until_tomorrow', label: 'Until tomorrow' },
    { value: '7_days', label: '7 days' },
    { value: '14_days', label: '14 days' },
    { value: 'custom', label: 'Custom Date', icon: CalendarIcon },
];

function StatusBadge({ status }: { status: ActivityStatus }) {
    const meta = STATUS_META[status];
    const Icon = meta.icon;
    return (
        <span className="activity-status-badge" style={{ backgroundColor: meta.color }} aria-hidden="true">
            <Icon className="activity-status-badge-icon" />
        </span>
    );
}

function RadioMark({ selected }: { selected: boolean }) {
    return (
        <span className={`activity-status-radio${selected ? ' selected' : ''}`} aria-hidden="true">
            <span className="activity-status-radio-inner" />
        </span>
    );
}

export default function ActivityStatus() {
    const { user } = useAuth();
    const { canUsePreferences } = useCookieConsent();

    const [savedState, setSavedState] = useState<ActivityStatusState>(DEFAULT_STATE);
    const [draftStatus, setDraftStatus] = useState<ActivityStatus>(DEFAULT_STATE.status);
    const [draftDuration, setDraftDuration] = useState<StatusDuration>(DEFAULT_STATE.duration);
    const [draftCustomStartDate, setDraftCustomStartDate] = useState<Date | undefined>(DEFAULT_STATE.customStartDate);
    const [draftCustomEndDate, setDraftCustomEndDate] = useState<Date | undefined>(DEFAULT_STATE.customEndDate);
    const [isMainOpen, setIsMainOpen] = useState(false);
    const [isKeepOpen, setIsKeepOpen] = useState(false);
    const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);

    const [, setNow] = useState(() => new Date());
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (canUsePreferences) {
            const loaded = loadSavedState();
            setSavedState(loaded);
            setDraftStatus(loaded.status);
            setDraftDuration(loaded.duration);
            setDraftCustomStartDate(loaded.customStartDate);
            setDraftCustomEndDate(loaded.customEndDate);
        } else {
            setSavedState(DEFAULT_STATE);
            setDraftStatus(DEFAULT_STATE.status);
            setDraftDuration(DEFAULT_STATE.duration);
            setDraftCustomStartDate(DEFAULT_STATE.customStartDate);
            setDraftCustomEndDate(DEFAULT_STATE.customEndDate);
        }
    }, [canUsePreferences]);

    const mainSheet = useDraggableSheet({
        onClose: () => setIsMainOpen(false),
        transitionDurationMs: 300,
        transitionEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        closeTransitionDurationMs: 260,
        closeTransitionEasing: 'ease-in',
    });
    const keepSheet = useDraggableSheet({
        onClose: () => setIsKeepOpen(false),
        transitionDurationMs: 300,
        transitionEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        closeTransitionDurationMs: 260,
        closeTransitionEasing: 'ease-in',
    });
    const customDateSheet = useDraggableSheet({
        onClose: () => setIsCustomDateOpen(false),
        transitionDurationMs: 300,
        transitionEasing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        closeTransitionDurationMs: 260,
        closeTransitionEasing: 'ease-in',
    });

    useEffect(() => {
        const syncFromStorage = () => {
            if (!canUsePreferences) return;
            const nextState = loadSavedState();
            setSavedState(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(nextState)) {
                    return nextState;
                }
                return prev;
            });
        };
        window.addEventListener('storage', syncFromStorage);
        return () => window.removeEventListener('storage', syncFromStorage);
    }, [canUsePreferences]);

    const openMain = () => {
        if (!canUsePreferences) return;
        const nextState = loadSavedState();
        setSavedState(nextState);
        setDraftStatus(nextState.status);
        setDraftDuration(nextState.duration);
        setDraftCustomStartDate(nextState.customStartDate);
        setDraftCustomEndDate(nextState.customEndDate);
        setIsMainOpen(true);
        mainSheet.open();
    };

    const closeMain = () => {
        if (isCustomDateOpen) {
            setIsCustomDateOpen(false);
            customDateSheet.close();
        }
        if (isKeepOpen) {
            setIsKeepOpen(false);
            keepSheet.close();
        }
        mainSheet.close();
    };

    const openKeep = () => {
        setIsKeepOpen(true);
        keepSheet.open();
    };

    const closeKeep = () => {
        keepSheet.close();
    };

    const openCustomDate = () => {
        if (!draftCustomStartDate) setDraftCustomStartDate(new Date());
        if (!draftCustomEndDate) {
            const baseDate = draftCustomStartDate ?? new Date();
            const defaultEndDate = new Date(baseDate);
            defaultEndDate.setDate(defaultEndDate.getDate() + 7);
            setDraftCustomEndDate(defaultEndDate);
        }
        setDraftDuration('custom');
        setIsCustomDateOpen(true);
        customDateSheet.open();
    };

    const closeCustomDate = () => {
        customDateSheet.close();
    };

    const handleSaveCustomDate = () => {
        if (!draftCustomStartDate || !draftCustomEndDate) return;
        if (draftCustomStartDate > draftCustomEndDate) {
            const nextEnd = new Date(draftCustomStartDate);
            setDraftCustomEndDate(nextEnd);
        }
        closeCustomDate();
    };

    const handleSaveDuration = () => {
        if (draftDuration !== 'custom') {
            setDraftCustomStartDate(undefined);
            setDraftCustomEndDate(undefined);
        }
        closeKeep();
    };

    const handleUpdate = () => {
        if (!canUsePreferences) return;
        const nextState: ActivityStatusState = {
            status: draftStatus,
            duration: draftDuration,
            customStartDate:
                draftDuration === 'custom' ? draftCustomStartDate ?? new Date() : undefined,
            customEndDate:
                draftDuration === 'custom'
                    ? draftCustomEndDate ?? draftCustomStartDate ?? new Date()
                    : undefined,
        };
        setSavedState(nextState);
        setDraftCustomStartDate(nextState.customStartDate);
        setDraftCustomEndDate(nextState.customEndDate);
        saveState(nextState);
        if (user) {
            void pushSettings(user.id, {
                status: {
                    status: nextState.status,
                    duration: nextState.duration,
                    customStartDate: nextState.customStartDate
                        ? nextState.customStartDate.toISOString()
                        : null,
                    customEndDate: nextState.customEndDate
                        ? nextState.customEndDate.toISOString()
                        : null,
                },
            }).catch(() => {});
        }
        if (isCustomDateOpen) {
            setIsCustomDateOpen(false);
            customDateSheet.close();
        }
        if (isKeepOpen) {
            setIsKeepOpen(false);
            keepSheet.close();
        }
        mainSheet.close();
    };

    const effectiveStatus = getEffectiveStatus(savedState);
    const currentStatusMeta = STATUS_META[effectiveStatus];
    const subtitleText = getSubtitle(savedState);

    if (!canUsePreferences) {
        return null;
    }

    return (
        <section className="activity-status-section">
            <button
                type="button"
                className="activity-status-trigger"
                onClick={openMain}
                aria-haspopup="dialog"
                aria-expanded={isMainOpen}
            >
                <StatusBadge status={effectiveStatus} />
                <span className="activity-status-trigger-copy">
                    <span className="activity-status-trigger-title">{currentStatusMeta.label}</span>
                    <span className="activity-status-trigger-subtitle">{subtitleText}</span>
                </span>
                <ChevronDownIcon className="activity-status-trigger-chevron" aria-hidden="true" />
            </button>

            <div
                className="app-overlay activity-status-overlay"
                ref={mainSheet.setOverlayRef}
                onClick={(event) => {
                    if (event.target === event.currentTarget) closeMain();
                }}
                role="dialog"
                aria-modal="true"
                aria-label="Activity Status"
            >
                <div
                    className="modal activity-status-modal"
                    ref={mainSheet.setModalRef}
                    id="activityStatusModal"
                >
                    <div className="modal-handle-zone" {...mainSheet.handleProps}>
                        <div className="modal-handle" />
                    </div>
                    <div className="modal-header">
                        <div className="modal-btn">
                            <button className="back-btn" id="activityStatusBackBtn" style={{ opacity: 0 }}>
                                <svg height="18" viewBox="0 -960 960 960" width="18" fill="currentColor">
                                    <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                                </svg>
                            </button>
                        </div>
                        <div className="modal-title" id="modalTitle">
                            Activity Status
                        </div>
                    </div>
                    <div className="activity-status-modal-body modal-body">
                        <div className="activity-status-option-list" role="radiogroup" aria-label="Select status">
                            {STATUS_ORDER.map((status) => {
                                const meta = STATUS_META[status];
                                const selected = draftStatus === status;
                                return (
                                    <button
                                        key={status}
                                        type="button"
                                        className={`activity-status-option-card${selected ? ' selected' : ''}`}
                                        onClick={() => setDraftStatus(status)}
                                        aria-pressed={selected}
                                    >
                                        <StatusBadge status={status} />
                                        <span className="activity-status-option-copy">
                                            <span className="activity-status-option-title">{meta.label}</span>
                                            <span className="activity-status-option-description">
                                                {meta.description}
                                            </span>
                                        </span>
                                        <RadioMark selected={selected} />
                                    </button>
                                );
                            })}
                        </div>

                        <button type="button" className="activity-status-keep-row" onClick={openKeep}>
                            <span className="activity-status-keep-left">
                                <ClockIcon className="activity-status-keep-icon" aria-hidden="true" />
                                <span>Keep status</span>
                            </span>
                            <span className="activity-status-keep-right">
                                <span>
                                    {formatDurationLabel(
                                        draftDuration,
                                        draftDuration === 'custom' ? draftCustomStartDate : undefined,
                                        draftDuration === 'custom' ? draftCustomEndDate : undefined
                                    )}
                                </span>
                                <ChevronRightIcon className="activity-status-keep-chevron" aria-hidden="true" />
                            </span>
                        </button>
                    </div>
                    <div className="activity-status-footer">
                        <button type="button" className="activity-status-primary-btn" onClick={handleUpdate}>
                            Update
                        </button>
                    </div>
                </div>
            </div>

            <div
                className="app-overlay activity-status-overlay activity-status-overlay--keep"
                ref={keepSheet.setOverlayRef}
                onClick={(event) => {
                    if (event.target === event.currentTarget) closeKeep();
                }}
                role="dialog"
                aria-modal="true"
                aria-label="Keep status"
            >
                <div
                    className="modal activity-status-modal activity-status-modal--keep"
                    ref={keepSheet.setModalRef}
                    id="activityStatusKeepModal"
                >
                    <div className="modal-handle-zone" {...keepSheet.handleProps}>
                        <div className="modal-handle" />
                    </div>
                    <div className="modal-header">
                        <div className="modal-btn">
                            <button className="back-btn" id="keepStatusBackBtn" style={{ opacity: 0 }}>
                                <svg height="18" viewBox="0 -960 960 960" width="18" fill="currentColor">
                                    <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                                </svg>
                            </button>
                        </div>
                        <div className="modal-title" id="modalTitle">
                            Keep status
                        </div>
                    </div>
                    <div className="activity-status-modal-body activity-status-modal-body--keep modal-body">
                        <div className="activity-status-duration-list" role="radiogroup" aria-label="Select duration">
                            {DURATION_OPTIONS.map((option) => {
                                const selected = draftDuration === option.value;
                                const OptionIcon = option.icon;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`activity-status-duration-row${selected ? ' selected' : ''}`}
                                        onClick={() => {
                                            if (option.value === 'custom') {
                                                openCustomDate();
                                                return;
                                            }
                                            setDraftDuration(option.value);
                                        }}
                                        aria-pressed={selected}
                                    >
                                        <span className="activity-status-duration-left">
                                            {OptionIcon ? (
                                                <OptionIcon className="activity-status-duration-calendar" />
                                            ) : null}
                                            <span>{option.label}</span>
                                        </span>
                                        <RadioMark selected={selected} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="activity-status-footer">
                        <button type="button" className="activity-status-primary-btn" onClick={handleSaveDuration}>
                            Save
                        </button>
                    </div>
                </div>
            </div>

            <div
                className="app-overlay activity-status-overlay activity-status-overlay--keep activity-status-overlay--custom"
                ref={customDateSheet.setOverlayRef}
                onClick={(event) => {
                    if (event.target === event.currentTarget) closeCustomDate();
                }}
                role="dialog"
                aria-modal="true"
                aria-label="Custom date range"
            >
                <div
                    className="modal activity-status-modal activity-status-modal--keep activity-status-modal--custom"
                    ref={customDateSheet.setModalRef}
                    id="activityStatusCustomDateModal"
                >
                    <div className="modal-handle-zone" {...customDateSheet.handleProps}>
                        <div className="modal-handle" />
                    </div>
                    <div className="modal-header">
                        <div className="modal-btn">
                            <button className="back-btn" id="customDateBackBtn" style={{ opacity: 0 }}>
                                <svg height="18" viewBox="0 -960 960 960" width="18" fill="currentColor">
                                    <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                                </svg>
                            </button>
                        </div>
                        <div className="modal-title" id="modalTitle">
                            Custom Date
                        </div>
                    </div>
                    <div className="activity-status-modal-body activity-status-modal-body--keep activity-status-modal-body--custom modal-body">
                        <div className="activity-status-range-grid">
                            <label className="activity-status-range-field">
                                <span className="activity-status-range-label">Start date</span>
                                <div className="activity-status-range-input-row">
                                    <CalendarIcon className="activity-status-range-icon" aria-hidden="true" />
                                    <input
                                        type="date"
                                        value={toDateInputValue(draftCustomStartDate)}
                                        onChange={(event) =>
                                            setDraftCustomStartDate(
                                                fromDateInputValue(event.currentTarget.value)
                                            )
                                        }
                                    />
                                </div>
                            </label>
                            <label className="activity-status-range-field">
                                <span className="activity-status-range-label">End date</span>
                                <div className="activity-status-range-input-row">
                                    <CalendarIcon className="activity-status-range-icon" aria-hidden="true" />
                                    <input
                                        type="date"
                                        value={toDateInputValue(draftCustomEndDate)}
                                        min={toDateInputValue(draftCustomStartDate)}
                                        onChange={(event) =>
                                            setDraftCustomEndDate(
                                                fromDateInputValue(event.currentTarget.value)
                                            )
                                        }
                                    />
                                </div>
                            </label>
                        </div>
                    </div>
                    <div className="activity-status-footer">
                        <button type="button" className="activity-status-primary-btn" onClick={handleSaveCustomDate}>
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}