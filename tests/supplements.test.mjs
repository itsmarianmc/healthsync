import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync('src/app/_lib/supplements.ts', 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function('require', 'module', 'exports', js)(() => ({}), loaded, loaded.exports);
const { isSupplementDue, parseCustomSupplements } = loaded.exports;

test('weekday schedules use Monday=1 through Sunday=7', () => {
  const schedule = { mode: 'weekdays', weekdays: [1, 7] };
  assert.equal(isSupplementDue(schedule, '2026-10-05'), true);
  assert.equal(isSupplementDue(schedule, '2026-10-06'), false);
  assert.equal(isSupplementDue(schedule, '2026-10-11'), true);
});

test('an interval starts on its start date and is never due before it', () => {
  const schedule = { mode: 'interval', everyDays: 3, startDate: '2026-10-05' };
  assert.equal(isSupplementDue(schedule, '2026-10-05'), true);
  assert.equal(isSupplementDue(schedule, '2026-10-08'), true);
  assert.equal(isSupplementDue(schedule, '2026-10-07'), false);
  assert.equal(isSupplementDue(schedule, '2026-10-04'), false);
});

test('two-day intervals roll across the week by elapsed calendar days', () => {
  const schedule = { mode: 'interval', everyDays: 2, startDate: '2026-03-23' };
  assert.equal(isSupplementDue(schedule, '2026-03-23'), true);
  assert.equal(isSupplementDue(schedule, '2026-03-29'), true);
  assert.equal(isSupplementDue(schedule, '2026-03-30'), false);
  assert.equal(isSupplementDue(schedule, '2026-03-31'), true);
  assert.equal(isSupplementDue(schedule, '2026-04-02'), true);
});

test('malformed definitions and dates are rejected without throwing', () => {
  assert.equal(parseCustomSupplements('{invalid'), null);
  assert.equal(parseCustomSupplements([{ id: 'bad', name: 'Invalid', schedule: { mode: 'weekdays', weekdays: [1, 1] } }]), null);
  assert.equal(parseCustomSupplements([{ id: 'bad', name: 'Invalid', schedule: { mode: 'interval', everyDays: 1, startDate: '2026-02-30' } }]), null);
  assert.equal(isSupplementDue({ mode: 'interval', everyDays: 2, startDate: '2026-02-30' }, '2026-03-02'), false);
  assert.equal(isSupplementDue({ mode: 'weekdays', weekdays: [] }, '2026-10-05'), false);
  assert.equal(isSupplementDue({ mode: 'weekdays', weekdays: [1] }, '2026-10-05T00:00:00Z'), false);
});

test('calendar-day intervals remain correct across the Berlin spring DST change', () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = 'Europe/Berlin';
  try {
    const beforeDST = new Date(2026, 2, 28);
    const afterDST = new Date(2026, 2, 30);
    assert.equal(afterDST.getTime() - beforeDST.getTime(), 47 * 60 * 60 * 1000);
    assert.equal(isSupplementDue({ mode: 'interval', everyDays: 2, startDate: '2026-03-28' }, '2026-03-30'), true);
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
