'use client';

import { useRef, useState } from 'react';
import { MailPlus, Trash2, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import type { TeamResponse } from '@/types/api';

interface MembersEditorProps {
  teamId: string;
  /** Namespace de i18n: 'equipo' o 'admin' */
  ns?: 'equipo' | 'admin';
  initialMembers: string[];
  onSaved?: (miembros: string[]) => void;
  /** Si true, el componente es de solo lectura (sin botones de edición) */
  readOnly?: boolean;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Editor de miembros de equipo — lista de emails con alta/baja y guardado.
 * Reutilizable en el panel de equipo y en el panel de administración.
 */
export function MembersEditor({
  teamId,
  ns = 'equipo',
  initialMembers,
  onSaved,
  readOnly = false,
}: MembersEditorProps) {
  const t = useTranslations(ns);

  const [members, setMembers] = useState<string[]>(initialMembers);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addMember = () => {
    const email = inputValue.trim().toLowerCase();
    if (!email) return;

    if (!emailRegex.test(email)) {
      setInputError(t('miembrosEmailInvalido'));
      return;
    }
    if (members.includes(email)) {
      setInputError(t('miembrosEmailDuplicado'));
      return;
    }

    setMembers((prev) => [...prev, email]);
    setInputValue('');
    setInputError(null);
    setSaveSuccess(false);
    inputRef.current?.focus();
  };

  const removeMember = (email: string) => {
    setMembers((prev) => prev.filter((member) => member !== email));
    setSaveSuccess(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addMember();
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await apiFetch<TeamResponse>(`/teams/${teamId}/members`, {
        method: 'PUT',
        body: JSON.stringify({ miembros: members }),
      });
      setSaveSuccess(true);
      onSaved?.(updated.miembros);
    } catch {
      setSaveError(t('miembrosError'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}
        >
          <Users size={20} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: '#94a3b8' }}>
            {t('miembros')}
          </p>
          <h3 className="mt-2 text-xl font-semibold" style={{ color: '#f8fafc' }}>
            {t('panelMembersTitle')}
          </h3>
          <p className="mt-2 text-sm leading-6" style={{ color: '#94a3b8' }}>
            {readOnly ? t('miembros') : t('miembrosDesc')}
          </p>
        </div>
      </div>

      <div
        className="rounded-[24px] border p-4"
        style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(8, 17, 29, 0.55)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>
            {t('panelMembersCount', { count: members.length })}
          </p>
          <div
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc' }}
          >
            {members.length}/20
          </div>
        </div>

        {members.length === 0 ? (
          <div
            className="mt-4 rounded-2xl border px-4 py-8 text-center"
            style={{ borderColor: 'rgba(148, 163, 184, 0.12)', background: 'rgba(15, 23, 42, 0.7)' }}
          >
            <p className="text-sm font-medium italic" style={{ color: '#94a3b8' }}>
              {t('miembrosVacio')}
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3">
            {members.map((email) => (
              <li
                key={email}
                className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
                style={{ borderColor: 'rgba(148, 163, 184, 0.12)', background: 'rgba(15, 23, 42, 0.7)' }}
              >
                <span className="min-w-0 truncate font-mono text-sm" style={{ color: '#e2e8f0' }}>
                  {email}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeMember(email)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl transition"
                    style={{ background: 'rgba(248,113,113,0.1)', color: '#fca5a5' }}
                    aria-label={`${t('miembrosEliminar')} ${email}`}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!readOnly && (
        <div
          className="rounded-[24px] border p-4"
          style={{ borderColor: 'rgba(148, 163, 184, 0.14)', background: 'rgba(8, 17, 29, 0.55)' }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#fbbf24' }}
            >
              <MailPlus size={18} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#f8fafc' }}>
                {t('panelMembersAddTitle')}
              </p>
              <p className="mt-1 text-sm leading-6" style={{ color: '#94a3b8' }}>
                {t('panelMembersAddDesc')}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              ref={inputRef}
              type="email"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setInputError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('miembrosPlaceholder')}
              className="flex-1 rounded-2xl px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-cyan-400/30"
              style={{
                background: 'rgba(15, 23, 42, 0.78)',
                color: '#f8fafc',
                border: `1px solid ${inputError ? 'rgba(248,113,113,0.6)' : 'rgba(148, 163, 184, 0.22)'}`,
              }}
            />
            <button
              type="button"
              onClick={addMember}
              className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition"
              style={{ background: 'rgba(56,189,248,0.14)', color: '#7dd3fc' }}
            >
              {t('miembrosAgregar')}
            </button>
          </div>

          {inputError && (
            <p className="mt-3 text-xs" style={{ color: '#fca5a5' }}>
              {inputError}
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs">
              {saveSuccess ? (
                <span style={{ color: '#86efac' }}>{t('miembrosGuardado')}</span>
              ) : null}
              {saveError ? (
                <span style={{ color: '#fca5a5' }}>{saveError}</span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:opacity-50"
              style={{ background: '#f59e0b', color: '#111827', boxShadow: '0 14px 30px rgba(245,158,11,0.18)' }}
            >
              {isSaving ? t('miembrosGuardando') : t('miembrosGuardar')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
