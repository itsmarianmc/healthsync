import test from 'node:test';
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { moduleLoader } from './helpers/loadTs.mjs';

const planner = moduleLoader({ 'server-only': {}, 'node:crypto': { randomInt } })('./pushReminderPlan');
const localClock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function checkPlan(plan) {
    assert.equal(plan.timeZone, 'Europe/Berlin');
    assert.equal(plan.events.length, 5);
    assert.equal(new Set(plan.events.map(event => event.eventId)).size, 5);
    const minutes = plan.events.map((event, index) => {
        const parts = Object.fromEntries(localClock.formatToParts(new Date(event.scheduledAt)).map(part => [part.type, part.value]));
        assert.equal(`${parts.year}-${parts.month}-${parts.day}`, plan.date);
        assert.match(event.scheduledAt, /T\d{2}:\d{2}:00\.000Z$/);
        assert.equal(event.category, planner.REMINDER_WINDOWS[index].category);
        const minute = Number(parts.hour) * 60 + Number(parts.minute);
        assert.ok(minute >= planner.REMINDER_WINDOWS[index].start);
        assert.ok(minute <= planner.REMINDER_WINDOWS[index].end);
        return minute;
    });
    for (let index = 1; index < minutes.length; index++) {
        assert.ok(minutes[index] - minutes[index - 1] >= 45);
        assert.ok(Date.parse(plan.events[index].scheduledAt) - Date.parse(plan.events[index - 1].scheduledAt) >= 45 * 60_000);
    }
}

test('all windows and minimum gaps hold for every day across a DST year', () => {
    let state = 20261024;
    const select = (min, max) => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return min + state % (max - min);
    };
    for (let day = 0; day < 365; day++) {
        const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
        checkPlan(planner.createReminderPlan(date, select));
    }
});

test('inclusive window boundaries are valid, including exactly 45 minutes apart', () => {
    for (const select of [(min) => min, (_min, max) => max - 1]) {
        const plan = planner.createReminderPlan('2026-10-24', select);
        checkPlan(plan);
        assert.equal(new Date(plan.events[0].scheduledAt).getUTCHours(), select(7, 10) - 2);
    }
});

test('colliding draws retry a bounded number of times then use a valid fallback', () => {
    let draws = 0;
    const plan = planner.createReminderPlan('2026-10-24', (min, max) => {
        draws++;
        return min === 11 * 60 + 30 ? max - 1 : min;
    });
    assert.equal(draws, planner.REMINDER_MAX_SELECTION_ATTEMPTS * 5);
    checkPlan(plan);
    assert.equal(plan.events[1].scheduledAt, '2026-10-24T10:30:00.000Z');
});

test('a successful reselection replaces the colliding candidate', () => {
    let draws = 0;
    const plan = planner.createReminderPlan('2026-10-24', (min, max) => {
        draws++;
        return draws <= 5 && min === 11 * 60 + 30 ? max - 1 : min;
    });
    assert.equal(draws, 10);
    checkPlan(plan);
});

test('UTC conversion uses the event offset on both DST transition dates', () => {
    for (const [date, expected] of [
        ['2026-03-28', '06:00'], ['2026-03-29', '05:00'],
        ['2026-10-24', '05:00'], ['2026-10-25', '06:00'],
    ]) {
        const plan = planner.createReminderPlan(date, min => min);
        checkPlan(plan);
        assert.equal(plan.events[0].scheduledAt, `${date}T${expected}:00.000Z`);
    }
});

test('invalid dates and invalid random sources fail before returning a plan', () => {
    for (const date of ['2026-02-30', '2025-02-29', '2026-13-01', '2026-1-01', '2026-10-24T00:00:00Z', '', 'invalid']) {
        assert.throws(() => planner.createReminderPlan(date), /Invalid reminder date/);
    }
    for (const select of [() => NaN, min => min - 1, (_min, max) => max, min => min + 0.5]) {
        assert.throws(() => planner.createReminderPlan('2026-10-24', select), /Invalid reminder random selection/);
    }
    checkPlan(planner.createReminderPlan('2028-02-29', min => min));
});

test('event keys are stable across candidate draws; scheduler bodies contain only allowed metadata', () => {
    const early = planner.createReminderPlan('2026-10-24', min => min);
    const late = planner.createReminderPlan('2026-10-24', (_min, max) => max - 1);
    assert.deepEqual(early.events.map(event => event.eventId), late.events.map(event => event.eventId));
    assert.notDeepEqual(early.events.map(event => event.scheduledAt), late.events.map(event => event.scheduledAt));
    for (const event of early.events) {
        assert.deepEqual(planner.reminderJob({ ...event, endpoint: 'private', auth: 'private', supplement: 'private' }), {
            date: '2026-10-24', category: event.category, eventId: event.eventId,
        });
    }
});
