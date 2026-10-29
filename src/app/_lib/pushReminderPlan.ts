import 'server-only';
import { randomInt } from 'node:crypto';

export const REMINDER_TIME_ZONE = 'Europe/Berlin';
export const REMINDER_MIN_GAP_MINUTES = 45;
export const REMINDER_MAX_SELECTION_ATTEMPTS = 32;

export const REMINDER_WINDOWS = [
    { category: 'breakfast', start: 7 * 60, end: 9 * 60, fallback: 8 * 60 },
    { category: 'lunch', start: 11 * 60 + 30, end: 13 * 60 + 30, fallback: 12 * 60 + 30 },
    { category: 'supplements', start: 14 * 60, end: 14 * 60 + 45, fallback: 14 * 60 + 15 },
    { category: 'snack', start: 15 * 60 + 30, end: 16 * 60 + 15, fallback: 15 * 60 + 45 },
    { category: 'dinner', start: 17 * 60, end: 20 * 60, fallback: 18 * 60 + 30 },
] as const;

export type ReminderCategory = typeof REMINDER_WINDOWS[number]['category'];
export type ReminderJob = { date: string; category: ReminderCategory; eventId: string };
export type ReminderEvent = ReminderJob & { scheduledAt: string };
export type ReminderPlan = { date: string; timeZone: typeof REMINDER_TIME_ZONE; events: ReminderEvent[] };

const localClock = new Intl.DateTimeFormat('en-GB', {
    timeZone: REMINDER_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function calendarDate(date: string): number {
    if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid reminder date');
    const epoch = Date.parse(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(epoch) || new Date(epoch).toISOString().slice(0, 10) !== date) {
        throw new Error('Invalid reminder date');
    }
    return epoch;
}

function wallClockEpoch(epoch: number): number {
    const parts = localClock.formatToParts(epoch);
    const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value);
    return Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
}

function utcInstant(midnight: number, minute: number): string {
    const wall = midnight + minute * 60_000;
    let candidate = wall;
    // Resolve the IANA offset at the event, including days on which DST changes.
    for (let attempt = 0; attempt < 3; attempt++) {
        const difference = wall - wallClockEpoch(candidate);
        if (difference === 0) return new Date(candidate).toISOString();
        candidate += difference;
    }
    throw new Error('Unresolvable reminder time');
}

function spaced(minutes: readonly number[]): boolean {
    return minutes.every((minute, index) => index === 0 || minute - minutes[index - 1] >= REMINDER_MIN_GAP_MINUTES);
}

/** Pure candidate generation only. Persist atomically before publishing; never regenerate a stored day. */
export function createReminderPlan(date: string, select: (min: number, max: number) => number = randomInt): ReminderPlan {
    const midnight = calendarDate(date);
    let minutes: number[] | undefined;
    for (let attempt = 0; attempt < REMINDER_MAX_SELECTION_ATTEMPTS; attempt++) {
        const candidate = REMINDER_WINDOWS.map(window => {
            const minute = select(window.start, window.end + 1);
            if (!Number.isInteger(minute) || minute < window.start || minute > window.end) {
                throw new Error('Invalid reminder random selection');
            }
            return minute;
        });
        if (spaced(candidate)) { minutes = candidate; break; }
    }
    minutes ??= REMINDER_WINDOWS.map(window => window.fallback);
    return {
        date, timeZone: REMINDER_TIME_ZONE,
        events: REMINDER_WINDOWS.map((window, index) => ({
            date, category: window.category, eventId: `healthsync-reminder:${date}:${window.category}`,
            scheduledAt: utcInstant(midnight, minutes[index]),
        })),
    };
}

/** Explicit allowlist for the scheduler body. The UTC instant belongs in scheduling metadata. */
export function reminderJob(event: ReminderEvent): ReminderJob {
    return { date: event.date, category: event.category, eventId: event.eventId };
}
