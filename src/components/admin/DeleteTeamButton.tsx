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
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : '';
      let message = t('errorEliminar');
      try {
        const body = JSON.parse(errMessage || '{}');
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
        className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
        title={t('eliminarEquipo')}
      >
        ✕
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-sm rounded-xl p-6 space-y-4 bg-slate-800 border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-cyan-400">
              {t('eliminarEquipo')}
            </h3>

            {bloqueado ? (
              <p className="text-sm text-amber-300">
                {t('equipoEnPartida')}
              </p>
            ) : (
              <p className="text-sm text-slate-300">
                {t('confirmarEliminar', { nombre: teamName })}
              </p>
            )}

            {error && !bloqueado && (
              <p className="text-xs text-red-400">
                {error}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleClose}
                className="px-4 py-1.5 rounded text-sm bg-slate-700 text-slate-300 hover:bg-slate-600"
              >
                {tCommon('cancelar')}
              </button>
              {!bloqueado && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-1.5 rounded text-sm font-semibold disabled:opacity-50 bg-red-500 text-white hover:bg-red-600"
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
