'use client';

interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-md text-sm"
      style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #991b1b' }}
      role="alert"
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-4 text-xs opacity-70 hover:opacity-100"
          aria-label="Cerrar"
        >
          ✕
        </button>
      )}
    </div>
  );
}
