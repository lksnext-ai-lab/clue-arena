import type { ReactNode } from 'react';
import { TableOfContents } from './TableOfContents';

interface InstructionsLayoutProps {
  children: ReactNode;
}

export function InstructionsLayout({ children }: InstructionsLayoutProps) {
  return (
    <>
      {/* Minimal navbar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-950/90 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="font-bold text-cyan-400 tracking-tight">Clue Arena</span>
          <span className="text-slate-600">/</span>
          <span className="text-sm text-slate-400">Guía para construir agentes</span>
        </div>
        <a
          href="/login"
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
        >
          ← Ir a la plataforma
        </a>
      </header>

      {/* Main content */}
      <div className="mx-auto max-w-screen-xl px-4 py-8 xl:flex xl:gap-12">
        {/* Content column */}
        <main className="min-w-0 flex-1 space-y-14">{children}</main>

        {/* TOC sidebar (visible xl+) */}
        <aside className="hidden xl:block xl:w-56 shrink-0">
          <div className="sticky top-24">
            <TableOfContents />
          </div>
        </aside>
      </div>
    </>
  );
}
