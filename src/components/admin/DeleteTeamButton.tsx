'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import type { DeleteTeamResponse } from '@/types/api';

interface Props {
  teamId: string;
  teamName: string;
  onDeleted: (result?: DeleteTeamResponse) => void;
  variant?: 'default' | 'icon';
}

/**
 * Botón de eliminación de equipo con confirm dialog.
 * Maneja el código 409 EQUIPO_EN_PARTIDA mostrando aviso bloqueante.
 */
export function DeleteTeamButton({ teamId, teamName, onDeleted, variant = 'default' }: Props) {
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
      const result = await apiFetch<DeleteTeamResponse>(`/teams/${teamId}`, { method: 'DELETE' });
      setOpen(false);
      onDeleted(result);
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
        type="button"
        aria-label={t('eliminarEquipo')}
        title={t('eliminarEquipo')}
        className={
          variant === 'icon'
            ? 'inline-flex h-10 w-10 items-center justify-center rounded-xl border transition'
            : 'inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition'
        }
        style={
          variant === 'icon'
            ? {
                borderColor: 'rgba(248,113,113,0.18)',
                background: 'rgba(127,29,29,0.18)',
                color: '#fca5a5',
              }
            : { background: 'rgba(248,113,113,0.12)', color: '#fca5a5' }
        }
      >
        {variant === 'icon' ? <Trash2 size={16} /> : t('eliminarEquipo')}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-[28px] border p-6"
            style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(9, 17, 31, 0.96)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold" style={{ color: '#f8fafc' }}>
              {t('eliminarEquipo')}
            </h3>

            {bloqueado ? (
              <p className="text-sm" style={{ color: '#fcd34d' }}>
                {t('equipoEnPartida')}
              </p>
            ) : (
              <p className="text-sm" style={{ color: '#cbd5e1' }}>
                {t('confirmarEliminar', { nombre: teamName })}
              </p>
            )}

            {error && !bloqueado && (
              <p className="text-xs" style={{ color: '#fca5a5' }}>
                {error}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleClose}
                className="rounded-2xl px-4 py-3 text-sm font-semibold transition"
                style={{ background: 'rgba(51,65,85,0.9)', color: '#cbd5e1' }}
              >
                {tCommon('cancelar')}
              </button>
              {!bloqueado && (
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-50"
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
