'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { getInstructionsCopy } from './copy';

export function TableOfContents() {
  const [activeId, setActiveId] = useState<string>('');
  const locale = useLocale();
  const copy = getInstructionsCopy(locale).toc;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the topmost visible section
          const topmost = visible.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
          setActiveId(topmost.target.id);
        }
      },
      { rootMargin: '-10% 0% -80% 0%', threshold: 0 },
    );

    copy.sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [copy.sections]);

  return (
    <nav aria-label={copy.ariaLabel} className="space-y-1">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {copy.heading}
      </p>
      {copy.sections.map(({ id, label, num }) => (
        <a
          key={id}
          href={`#${id}`}
          className={[
            'flex items-baseline gap-2 rounded px-2 py-1.5 text-sm transition-colors',
            activeId === id
              ? 'bg-slate-800 text-cyan-400 font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50',
          ].join(' ')}
        >
          <span className="font-mono text-xs text-slate-600 shrink-0">§{num}</span>
          {label}
        </a>
      ))}
    </nav>
  );
}
