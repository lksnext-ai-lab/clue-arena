'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { getInstructionsCopy } from './copy';

export function TableOfContents({ compact = false }: { compact?: boolean } = {}) {
  const [activeId, setActiveId] = useState<string>('');
  const navRef = useRef<HTMLElement | null>(null);
  const locale = useLocale();
  const copy = useMemo(() => getInstructionsCopy(locale).toc, [locale]);
  const sectionIds = useMemo(() => copy.sections.map(({ id }) => id).join('|'), [copy.sections]);

  useEffect(() => {
    const navElement = navRef.current;

    if (!navElement) return;

    const scrollContainer = findScrollContainer(navElement);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);

        if (visible.length === 0) {
          return;
        }

        const topmost = visible.reduce((current, entry) => {
          if (!current) return entry;
          return entry.boundingClientRect.top < current.boundingClientRect.top ? entry : current;
        });

        setActiveId(topmost.target.id);
      },
      {
        root: scrollContainer instanceof HTMLElement ? scrollContainer : null,
        rootMargin: '0px 0px -65% 0px',
        threshold: 0,
      },
    );

    const sections = copy.sections;

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    syncActiveSection(scrollContainer, sections, setActiveId);

    const handleScroll = () => syncActiveSection(scrollContainer, sections, setActiveId);

    if (scrollContainer instanceof HTMLElement) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    } else {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      observer.disconnect();
      if (scrollContainer instanceof HTMLElement) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      } else {
        window.removeEventListener('scroll', handleScroll);
      }
    };
  }, [copy.sections, sectionIds]);

  return (
    <nav ref={navRef} aria-label={copy.ariaLabel} className={compact ? 'space-y-3' : 'space-y-1'}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{copy.heading}</p>
      <div className={compact ? '-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0' : ''}>
        <div className={compact ? 'flex min-w-max gap-2 pb-1' : 'space-y-1'}>
          {copy.sections.map(({ id, label, num }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(event) => {
                event.preventDefault();
                const target = document.getElementById(id);
                target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setActiveId(id);
              }}
              aria-current={activeId === id ? 'location' : undefined}
              className={[
                compact
                  ? 'flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-sm transition-colors'
                  : 'flex items-baseline gap-2 rounded px-2 py-1.5 text-sm transition-colors',
                activeId === id
                  ? 'border-cyan-500/40 bg-slate-800 text-cyan-400 font-medium'
                  : compact
                    ? 'border-slate-800 bg-slate-900/70 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
              ].join(' ')}
            >
              <span className="shrink-0 font-mono text-xs text-slate-600">§{num}</span>
              <span>{label}</span>
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

function findScrollContainer(element: HTMLElement): HTMLElement | Window {
  let parent: HTMLElement | null = element.parentElement;

  while (parent && parent !== document.body) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;

    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return parent;
    }

    parent = parent.parentElement;
  }

  return window;
}

function syncActiveSection(
  scrollContainer: HTMLElement | Window,
  sections: Array<{ id: string }>,
  setActiveId: (id: string) => void,
) {
  const offset = 160;
  const candidates = sections
    .map(({ id }) => {
      const element = document.getElementById(id);
      if (!element) return null;

      const rect = element.getBoundingClientRect();
      const top = scrollContainer instanceof HTMLElement ? rect.top - scrollContainer.getBoundingClientRect().top : rect.top;

      return { id, distance: Math.abs(top - offset), top };
    })
    .filter((candidate): candidate is { id: string; distance: number; top: number } => candidate !== null);

  if (candidates.length === 0) return;

  candidates.sort((a, b) => {
    if (a.top <= offset && b.top > offset) return -1;
    if (b.top <= offset && a.top > offset) return 1;
    if (a.top <= offset && b.top <= offset) return b.top - a.top;
    return a.distance - b.distance;
  });

  setActiveId(candidates[0].id);
}
