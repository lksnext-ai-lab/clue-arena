'use client';

import { useState, useRef } from 'react';
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
    setMembers((prev) => prev.filter((m) => m !== email));
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
    <div className="space-y-3">
      {/* Title + description */}
      <div>
        <p className="text-xs font-medium" style={{ color: '#94a3b8' }}>
          {t('miembros')}
        </p>
        {!readOnly && (
          <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
            {t('miembrosDesc')}
          </p>
        )}
      </div>

      {/* Members list */}
      {members.length === 0 ? (
        <p className="text-xs italic" style={{ color: '#475569' }}>
          {t('miembrosVacio')}
        </p>
      ) : (
        <ul className="space-y-1">
          {members.map((email) => (
            <li
              key={email}
              className="flex items-center justify-between px-2 py-1 rounded text-xs"
              style={{ background: '#0f172a', border: '1px solid #1e293b' }}
            >
              <span style={{ color: '#cbd5e1' }} className="font-mono truncate">
                {email}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeMember(email)}
                  className="ml-2 text-xs flex-shrink-0 rounded px-1.5 py-0.5 transition-colors hover:bg-red-900"
                  style={{ color: '#f87171' }}
                  aria-label={`${t('miembrosEliminar')} ${email}`}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add input */}
      {!readOnly && (
        <>
          <div className="flex gap-2">
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
              className="flex-1 px-2 py-1.5 rounded text-xs"
              style={{
                background: '#0a0a0f',
                color: '#f1f5f9',
                border: `1px solid ${inputError ? '#ef4444' : '#64748b'}`,
              }}
            />
            <button
              type="button"
              onClick={addMember}
              className="px-3 py-1.5 rounded text-xs font-medium flex-shrink-0 transition-colors"
              style={{ background: '#334155', color: '#f1f5f9' }}
            >
              {t('miembrosAgregar')}
            </button>
          </div>
          {inputError && (
            <p className="text-xs" style={{ color: '#ef4444' }}>
              {inputError}
            </p>
          )}

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-1.5 rounded text-xs font-medium transition-colors disabled:opacity-50"
              style={{ background: '#f59e0b', color: '#0a0a0f' }}
            >
              {isSaving ? t('miembrosGuardando') : t('miembrosGuardar')}
            </button>
            {saveSuccess && (
              <span className="text-xs" style={{ color: '#4ade80' }}>
                ✓ {t('miembrosGuardado')}
              </span>
            )}
            {saveError && (
              <span className="text-xs" style={{ color: '#f87171' }}>
                {saveError}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
