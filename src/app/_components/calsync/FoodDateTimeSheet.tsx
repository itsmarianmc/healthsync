'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import FoodLibrarySheet from './FoodLibrarySheet';
import { calendarDay, dateWheelLabel, localBatchTime, wrapWheel } from '../../_lib/foodDateTime';

const ROW = 44, CENTER = 100;
const offsets = Array.from({ length: CENTER * 2 + 1 }, (_, i) => i - CENTER);

function Wheel({ label, initial, cycle, format, onChange }: {
    label: string; initial: number; cycle?: number; format: (value: number) => string; onChange: (value: number) => void;
}) {
    const scroller = useRef<HTMLDivElement>(null);
    const anchor = useRef(initial);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wheelTarget = useRef<number | null>(null);
    const [base, setBase] = useState(initial);
    const [value, setValue] = useState(initial);
    const normalize = (next: number) => cycle ? wrapWheel(next, cycle) : next;
    useLayoutEffect(() => {
        scroller.current!.scrollTop = CENTER * ROW;
        return () => { if (timer.current) clearTimeout(timer.current); };
    }, []);
    const read = () => {
        const el = scroller.current!;
        const delta = Math.round(el.scrollTop / ROW) - CENTER;
        const next = anchor.current + delta;
        setValue(normalize(next)); onChange(normalize(next));
        return { el, delta, next };
    };
    const recenter = (snap: boolean) => {
        const { el, delta, next } = read();
        // Keep the fractional position during a gesture; settling snaps to a row.
        const remainder = snap ? 0 : el.scrollTop - (CENTER + delta) * ROW;
        const remaining = wheelTarget.current === null ? null : wheelTarget.current - el.scrollTop;
        anchor.current = next; setBase(next);
        el.scrollTop = CENTER * ROW + remainder;
        if (remaining !== null) {
            wheelTarget.current = el.scrollTop + remaining;
            el.scrollTo({ top: wheelTarget.current, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        }
    };
    const move = (steps: number) => {
        wheelTarget.current = null;
        if (timer.current) clearTimeout(timer.current);
        const { next } = read();
        anchor.current = next + steps; setBase(anchor.current);
        setValue(normalize(anchor.current)); onChange(normalize(anchor.current));
        scroller.current!.scrollTop = CENTER * ROW;
    };
    useEffect(() => {
        const el = scroller.current;
        if (!el) return;
        const onWheel = (event: WheelEvent) => {
            if (event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
            event.preventDefault();
            if (timer.current) clearTimeout(timer.current);
            wheelTarget.current = (wheelTarget.current ?? Math.round(el.scrollTop / ROW) * ROW) + Math.sign(event.deltaY) * ROW;
            el.scrollTo({ top: wheelTarget.current, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    });
    return <div className="food-time-column">
        <span className="food-time-label" aria-hidden="true">{label}</span>
        <div className="food-time-wheel" ref={scroller} role="spinbutton" tabIndex={0} aria-label={label} aria-describedby="foodTimeInstructions"
            aria-valuenow={value} aria-valuetext={format(value)} aria-valuemin={cycle ? 0 : undefined} aria-valuemax={cycle ? cycle - 1 : undefined}
            onTouchStart={() => { wheelTarget.current = null; }}
            onKeyDown={event => {
                const step = ({ ArrowUp: -1, ArrowDown: 1, PageUp: -10, PageDown: 10 } as Record<string, number>)[event.key];
                if (step) { event.preventDefault(); move(step); }
                if (cycle && (event.key === 'Home' || event.key === 'End')) { event.preventDefault(); move((event.key === 'Home' ? 0 : cycle - 1) - value); }
            }} onScroll={() => {
                if (timer.current) clearTimeout(timer.current);
                const { delta } = read();
                if (Math.abs(delta) > 40) recenter(false);
                timer.current = setTimeout(() => { wheelTarget.current = null; recenter(true); }, 140);
            }}>
            {offsets.map(offset => <div key={offset} className="food-time-option" aria-hidden="true" onClick={() => move(base + offset - (anchor.current + Math.round(scroller.current!.scrollTop / ROW) - CENTER))}>
                {format(normalize(base + offset))}
            </div>)}
        </div>
    </div>;
}

export default function FoodDateTimeSheet({ ts, onClose, onDone }: { ts: number; onClose: () => void; onDone: (ts: number) => boolean }) {
    const initial = new Date(ts);
    const [day, setDay] = useState(() => calendarDay(initial));
    const [hour, setHour] = useState(() => initial.getHours());
    const [minute, setMinute] = useState(() => initial.getMinutes());
    const [dismiss, setDismiss] = useState(false);
    const [error, setError] = useState('');
    const result = localBatchTime(day, hour, minute);
    return <FoodLibrarySheet id="foodDateTime" title="Date and time" nested dismiss={dismiss} onClose={onClose} bodyClassName="food-time-body"
        footer={<div className="modal-footer food-review-footer"><button type="button" className="saved-food-log" disabled={result === null} onClick={() => {
            if (result !== null) {
                if (onDone(result)) setDismiss(true);
                else setError('Could not save this time. Free some storage and retry.');
            }
        }}>Done</button></div>}>
        <p className="sr-only" id="foodTimeInstructions">Use Up and Down to change a value, or Page Up and Page Down for ten steps. Hours and minutes wrap.</p>
        <div className="food-time-wheels">
            <Wheel label="Date" initial={calendarDay(initial)} format={dateWheelLabel} onChange={setDay} />
            <Wheel label="Hour" initial={initial.getHours()} cycle={24} format={value => String(value).padStart(2, '0')} onChange={setHour} />
            <Wheel label="Minute" initial={initial.getMinutes()} cycle={60} format={value => String(value).padStart(2, '0')} onChange={setMinute} />
        </div>
        {result === null && <p role="alert">This time is unavailable on that date. Choose another time.</p>}
        {error && <p role="alert">{error}</p>}
    </FoodLibrarySheet>;
}
