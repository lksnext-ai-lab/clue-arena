'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';

interface Props {
  teamId: string;
  teamName: string;
  onDeleted: () => void;
}

/**
 * Botón de eliminación de equipo con confirm dialog.
 * Maneja el código 409 EQUIPO_EN_PARTIDA mostrando aviso bloqueante.
 */
export function DeleteTeamButton({ teamId, teamName, onDeleted }: Props) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await apiFetch(`/teams/${teamId}`, { method: 'DELETE' });
      setOpen(false);
      onDeleted();
    } catch (err: any) {
      let message = t('errorEliminar');
      try {
        const body = JSON.parse(err?.message ?? '{}');
        if (body?.code === 'EQUIPO_EN_PARTIDA') {
          setBloqueado(true);
          message = t('equipoEnPartida');
        }
      } catch {
        // usar mensaje genérico
      }
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setBloqueado(false);
    setError(null);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded"
        style={{ color: '#ef4444', background: '#ef444422' }}
        title={t('eliminarEquipo')}
      >
        ✕
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={handleClose}
        >
          <div
            className="w-full max-w-sm rounded-xl p-6 space-y-4"
            style={{ background: '#1a1a2e', color: '#f1f5f9' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold" style={{ color: '#f59e0b' }}>
              {t('eliminarEquipo')}
            </h3>

            {bloqueado ? (
              <p className="text-sm" style={{ color: '#fca5a5' }}>
                {t('equipoEnPartida')}
              </p>
            ) : (
              <p className="text-sm">
                {t('confirmarEliminar', { nombre: teamName })}
              </p>
            )}

            {error && !bloqueado && (
              <p className="text-xs" style={{ color: '#ef4444' }}>
                {error}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-1.5 rounded text-sm"
                style={{ background: '#334155', color: '#f1f5f9' }}
              >
                {tCommon('cancelar')}
              </button>
              {!bloqueado && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-1.5 rounded text-sm font-semibold disabled:opacity-50"
                  style={{ background: '#ef4444', color: '#fff' }}
                >
                  {isDeleting ? '...' : t('eliminarEquipo')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
