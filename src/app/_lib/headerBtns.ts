'use client';

export function removeHeaderBtn(id: string): void {
    const btn = document.getElementById(id);
    if (!btn || btn.classList.contains('hidden')) return;
    const box = btn.closest<HTMLElement>('.button-box');
    btn.style.transition = 'width 0.2s ease, opacity 0.2s ease, padding 0.2s ease, margin 0.2s ease';
    btn.style.width = '0';
    btn.style.opacity = '0';
    btn.style.padding = '0';
    btn.style.margin = '0';
    btn.style.pointerEvents = 'none';
    btn.style.overflow = 'hidden';
    setTimeout(() => {
        btn.classList.add('hidden');
        btn.style.cssText = '';
        if (box && box.querySelectorAll('button:not(.hidden)').length === 0) box.classList.add('hidden');
    }, 200);
}

export function addHeaderBtn(id: string): void {
    const btn = document.getElementById(id);
    if (!btn || !btn.classList.contains('hidden')) return;
    const box = btn.closest<HTMLElement>('.button-box');
    if (box) box.classList.remove('hidden');
    btn.classList.remove('hidden');
    btn.style.cssText = 'width:0; opacity:0; padding:0; margin:0; overflow:hidden; transition:none; pointer-events:none;';
    if (box) {
        const order = parseInt(btn.dataset.order ?? '99');
        const siblings = [...box.querySelectorAll<HTMLElement>('button')];
        const ref = siblings.find(b => parseInt(b.dataset.order ?? '99') > order) ?? null;
        if (ref) box.insertBefore(btn, ref);
        else box.appendChild(btn);
    }
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
        btn.style.transition = 'width 0.2s ease, opacity 0.2s ease, padding 0.2s ease, margin 0.2s ease';
        btn.style.width = '50px';
        btn.style.opacity = '1';
        btn.style.padding = '';
        btn.style.margin = '';
        btn.style.overflow = '';
        btn.style.pointerEvents = '';
        });
    });
    setTimeout(() => { btn.style.cssText = ''; }, 220);
}
