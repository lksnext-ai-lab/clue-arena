import type { ReactNode } from 'react';
import { TableOfContents } from './TableOfContents';

interface InstructionsLayoutProps {
  children: ReactNode;
}

export function InstructionsLayout({ children }: InstructionsLayoutProps) {
  return (
    <>
      <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8 sm:py-8 xl:flex xl:gap-16 2xl:gap-20">
        <div className="mb-6 xl:hidden">
          <TableOfContents compact />
        </div>

        <main className="min-w-0 flex-1 space-y-10 sm:space-y-12 xl:space-y-14 2xl:space-y-16">{children}</main>

        <aside className="hidden shrink-0 xl:block xl:w-64 2xl:w-72">
          <div className="sticky top-24">
            <TableOfContents />
          </div>
        </aside>
      </div>
    </>
  );
}
