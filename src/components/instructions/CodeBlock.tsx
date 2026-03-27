'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

export function CodeBlock({ code, language = 'text', filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg overflow-hidden border border-slate-700 bg-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 px-3 py-2 sm:px-4">
        <span className="truncate font-mono text-xs text-slate-400">
          {filename ? (
            <span className="text-slate-300">{filename}</span>
          ) : (
            <span className="text-slate-500">{language}</span>
          )}
        </span>
        <button
          onClick={handleCopy}
          className="flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-slate-200"
          aria-label="Copiar código"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copiado</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      {/* Code */}
      <pre className="overflow-x-auto px-3 py-4 text-xs leading-6 text-slate-200 sm:px-4 sm:text-sm sm:leading-relaxed">
        <code className={language === 'text' ? 'block whitespace-pre-wrap break-words' : 'block min-w-max'}>{code}</code>
      </pre>
    </div>
  );
}
