import type { ReactNode } from 'react';

interface SectionWrapperProps {
  id: string;
  title: string;
  titleNumber: string;
  children: ReactNode;
}

export function SectionWrapper({ id, title, titleNumber, children }: SectionWrapperProps) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-6 flex items-baseline gap-3 text-xl font-bold text-cyan-400 border-b border-slate-700 pb-3">
        <span className="text-slate-500 font-mono text-base">§{titleNumber}</span>
        {title}
      </h2>
      <div className="space-y-4 text-slate-300 leading-relaxed">{children}</div>
    </section>
  );
}
