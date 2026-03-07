import type { ReactNode } from 'react';
import { TableOfContents } from './TableOfContents';

interface InstructionsLayoutProps {
  children: ReactNode;
}

export function InstructionsLayout({ children }: InstructionsLayoutProps) {
  return (
    <>
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
