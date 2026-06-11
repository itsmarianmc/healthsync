'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

const TABS = [
  { href: '/dash', view: 'dashboard', label: 'Home', index: 0 },
  { href: '/food', view: 'calsync', label: 'Food', index: 1 },
  { href: '/drinks', view: 'dropsync', label: 'Hydration', index: 2 },
];

export default function BottomNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(false);

  const activeIndex = TABS.findIndex(t => pathname.startsWith(t.href));
  const safeIndex = activeIndex === -1 ? 0 : activeIndex;

  useEffect(() => {
    const nav = navRef.current;
    const slider = sliderRef.current;
    if (!nav || !slider) return;

    const translateX = safeIndex * 103.5;

    if (!mountedRef.current) {
      // First render: snap into position without any transition
      mountedRef.current = true;
      slider.style.transition = 'none';
      slider.style.transform = `translateX(${translateX}%) scale(1)`;
      slider.style.background = 'rgba(58, 58, 60, 0.5)';
      slider.style.borderTop = '0px';
      slider.style.borderBottom = '0px';
      // Re-enable transition on next frame so subsequent navigations animate
      requestAnimationFrame(() => {
        if (slider) slider.style.transition = '';
      });
      window.dispatchEvent(new CustomEvent('viewChanged', {
        detail: { view: TABS[safeIndex].view },
      }));
      return;
    }

    slider.style.transform = `translateX(${translateX}%) scale(1.2)`;
    slider.style.borderTop = '1px solid var(--border)';
    slider.style.borderBottom = '1px solid var(--border)';
    slider.style.background = 'rgba(58, 58, 60, 0.25)';
    nav.style.transform = 'scale(1.025)';

    const t = setTimeout(() => {
      if (!nav || !slider) return;
      nav.style.transform = 'scale(1)';
      slider.style.transform = `translateX(${translateX}%) scale(1)`;
      slider.style.background = 'rgba(58, 58, 60, 0.5)';
      slider.style.borderTop = '0px';
      slider.style.borderBottom = '0px';
    }, 150);

    window.dispatchEvent(new CustomEvent('viewChanged', {
      detail: { view: TABS[safeIndex].view },
    }));

    return () => clearTimeout(t);
  }, [safeIndex]);

  return (
    <div className="bottom-nav" id="bottomNav" ref={navRef}>
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`nav-btn${safeIndex === tab.index ? ' active' : ''}`}
          data-view={tab.view}
          data-index={tab.index}
        >
          {tab.view === 'dashboard' && <i className="fa-solid fa-home" />}
          {tab.view === 'calsync' && <i className="fa-solid fa-utensils" />}
          {tab.view === 'dropsync' && <i className="fa-solid fa-droplet" />}
          <span>{tab.label}</span>
        </Link>
      ))}
      <div className="nav-slider" ref={sliderRef} />
    </div>
  );
}
