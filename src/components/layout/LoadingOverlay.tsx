'use client';

export function LoadingOverlay() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(10, 10, 15, 0.8)', backdropFilter: 'blur(4px)' }}
      role="status"
      aria-label="Cargando"
    >
      <div className="text-center space-y-3">
        <div
          className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin mx-auto"
          style={{ borderColor: '#f59e0b', borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: '#94a3b8' }}>
          Cargando...
        </p>
      </div>
    </div>
  );
}
