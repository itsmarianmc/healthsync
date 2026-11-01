const DAY = 86400000;
export function wrapWheel(value: number, size: number) { return ((value % size) + size) % size; }
export function calendarDay(date: Date) { return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY; }
export function dateForDay(day: number) {
    const utc = new Date(day * DAY);
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}
export function localBatchTime(day: number, hour: number, minute: number): number | null {
    const date = dateForDay(day);
    date.setHours(hour, minute, 0, 0);
    // A spring-forward gap has no matching local wall time. Ask for another time.
    return calendarDay(date) === day && date.getHours() === hour && date.getMinutes() === minute ? date.getTime() : null;
}
export function dateWheelLabel(day: number, now = new Date()) {
    return day === calendarDay(now) ? 'Today' : dateForDay(day).toLocaleDateString(undefined,
        { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}
export function batchTimeLabel(ts: number, now = new Date()) {
    const date = new Date(ts), day = calendarDay(date), today = calendarDay(now);
    const label = day === today ? 'Today' : day === today - 1 ? 'Yesterday' : day === today + 1 ? 'Tomorrow' : date.toLocaleDateString();
    return `${label} at ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}
