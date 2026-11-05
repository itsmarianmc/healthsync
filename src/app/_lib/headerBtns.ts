'use client';

type Motion = { direction: 'show' | 'hide'; timer?: ReturnType<typeof setTimeout>; frames: number[] };
const motions = new WeakMap<HTMLElement, Motion>();
function cancelMotion(button: HTMLElement) {
    const motion = motions.get(button);
    if (motion?.timer) clearTimeout(motion.timer);
    motion?.frames.forEach(cancelAnimationFrame);
    motions.delete(button);
    return motion;
}

export function removeHeaderBtn(id: string): void {
    const btn = document.getElementById(id);
    if (!btn) return;
    cancelMotion(btn);
    if (btn.classList.contains('hidden')) return;
    const motion: Motion = { direction: 'hide', frames: [] };
    motions.set(btn, motion);
    const box = btn.closest<HTMLElement>('.button-box');
    btn.style.transition = 'width 0.2s ease, opacity 0.2s ease, padding 0.2s ease, margin 0.2s ease';
    btn.style.width = '0';
    btn.style.opacity = '0';
    btn.style.padding = '0';
    btn.style.margin = '0';
    btn.style.pointerEvents = 'none';
    btn.style.overflow = 'hidden';
    motion.timer = setTimeout(() => {
        if (motions.get(btn) !== motion || !btn.isConnected) return;
        btn.classList.add('hidden');
        btn.style.cssText = '';
        if (box && box.querySelectorAll('button:not(.hidden)').length === 0) box.classList.add('hidden');
        motions.delete(btn);
    }, 200);
}

export function addHeaderBtn(id: string): void {
    const btn = document.getElementById(id);
    if (!btn) return;
    const previous = cancelMotion(btn);
    if (!btn.classList.contains('hidden') && !previous) return;
    const width = btn.classList.contains('hidden') ? 0 : btn.getBoundingClientRect().width;
    const motion: Motion = { direction: 'show', frames: [] };
    motions.set(btn, motion);
    const box = btn.closest<HTMLElement>('.button-box');
    if (box) box.classList.remove('hidden');
    btn.classList.remove('hidden');
    btn.style.cssText = `width:${width}px; opacity:0; padding:0; margin:0; overflow:hidden; transition:none; pointer-events:none;`;
    if (box) {
        const order = parseInt(btn.dataset.order ?? '99');
        const siblings = [...box.querySelectorAll<HTMLElement>('button')];
        const ref = siblings.find(b => parseInt(b.dataset.order ?? '99') > order) ?? null;
        if (ref) box.insertBefore(btn, ref);
        else box.appendChild(btn);
    }
    motion.frames.push(requestAnimationFrame(() => {
        motion.frames.push(requestAnimationFrame(() => {
        if (motions.get(btn) !== motion || !btn.isConnected) return;
        btn.style.transition = 'width 0.2s ease, opacity 0.2s ease, padding 0.2s ease, margin 0.2s ease';
        btn.style.width = '50px';
        btn.style.opacity = '1';
        btn.style.padding = '';
        btn.style.margin = '';
        btn.style.overflow = '';
        btn.style.pointerEvents = '';
        }));
    }));
    motion.timer = setTimeout(() => {
        if (motions.get(btn) !== motion || !btn.isConnected) return;
        btn.style.cssText = '';
        motions.delete(btn);
    }, 220);
}
