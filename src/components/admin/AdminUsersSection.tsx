'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Filter, Search, Shield, Sparkles, Trash2, UserRound, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { useTranslations } from 'next-intl';
import type { UserResponse } from '@/types/api';

type RoleFilter = 'all' | UserResponse['rol'];
type FeedbackState = { tone: 'success' | 'error'; message: string } | null;

const ROLE_OPTIONS: UserResponse['rol'][] = ['admin', 'equipo', 'espectador'];

function parseApiErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;

  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (typeof parsed.error === 'string' && parsed.error.trim().length > 0) {
      return parsed.error;
    }
  } catch {
    // Ignore JSON parsing errors and fall back to the original message.
  }

  return error.message && !error.message.startsWith('{') ? error.message : fallback;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function getRoleLabel(role: UserResponse['rol'], t: ReturnType<typeof useTranslations<'admin'>>) {
  switch (role) {
    case 'admin':
      return t('userRoleAdmin');
    case 'equipo':
      return t('userRoleEquipo');
    default:
      return t('userRoleEspectador');
  }
}

export function AdminUsersSection({
  initialUsers,
  currentUserId,
}: {
  initialUsers?: UserResponse[];
  currentUserId?: string | null;
}) {
  const t = useTranslations('admin');
  const hasInitialUsers = initialUsers !== undefined;
  const [users, setUsers] = useState<UserResponse[]>(initialUsers ?? []);
  const [isLoading, setIsLoading] = useState(!hasInitialUsers);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);

    try {
      const data = await apiFetch<{ users: UserResponse[] }>('/admin/users');
      setUsers(data.users);
      setFetchError(null);
    } catch (error) {
      setFetchError(parseApiErrorMessage(error, t('usuarioErrorCarga')));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!hasInitialUsers) {
      void loadUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInitialUsers]);

  useEffect(() => {
    if (initialUsers === undefined) return;
    setUsers(initialUsers);
    setIsLoading(false);
  }, [initialUsers]);

  const normalizedQuery = query.trim().toLowerCase();
  const totalAdmins = users.filter((user) => user.rol === 'admin').length;
  const totalEquipo = users.filter((user) => user.rol === 'equipo').length;
  const totalEspectadores = users.length - totalAdmins - totalEquipo;

  const filteredUsers = users.filter((user) => {
    if (roleFilter !== 'all' && user.rol !== roleFilter) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      user.nombre,
      user.email,
      user.equipo?.nombre ?? '',
      user.equipo?.agentId ?? '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery);
  });

  async function handleRoleChange(user: UserResponse, nextRole: UserResponse['rol']) {
    if (user.rol === nextRole) return;

    setSavingUserId(user.id);
    setFeedback(null);

    try {
      const updated = await apiFetch<UserResponse>(`/admin/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ rol: nextRole }),
      });

      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setFeedback({
        tone: 'success',
        message: t('usuarioRolActualizado', { nombre: updated.nombre }),
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: parseApiErrorMessage(error, t('usuarioErrorActualizar')),
      });
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleDelete(user: UserResponse) {
    if (user.id === currentUserId || user.equipo) return;

    const confirmed = window.confirm(
      t('usuarioEliminarConfirm', { nombre: user.nombre })
    );

    if (!confirmed) return;

    setDeletingUserId(user.id);
    setFeedback(null);

    try {
      await apiFetch(`/admin/users/${user.id}`, { method: 'DELETE' });
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      setFeedback({
        tone: 'success',
        message: t('usuarioEliminado', { nombre: user.nombre }),
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: parseApiErrorMessage(error, t('usuarioErrorEliminar')),
      });
    } finally {
      setDeletingUserId(null);
    }
  }

  if (isLoading) {
    return (
      <section className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="h-28 animate-pulse rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(7,11,22,0.86))]"
            />
          ))}
        </div>
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(7,11,22,0.94))] p-6">
          <p className="text-sm text-slate-400">{t('cargandoUsuarios')}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Users size={18} />} label={t('usuariosMetricTotal')} value={String(users.length)} accent="#38bdf8" />
        <MetricCard icon={<Shield size={18} />} label={t('usuariosMetricAdmins')} value={String(totalAdmins)} accent="#22c55e" />
        <MetricCard icon={<UserRound size={18} />} label={t('usuariosMetricEquipos')} value={String(totalEquipo)} accent="#fbbf24" />
        <MetricCard icon={<Sparkles size={18} />} label={t('usuariosMetricEspectadores')} value={String(totalEspectadores)} accent="#f472b6" />
      </div>

      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(160deg,rgba(8,17,29,0.94),rgba(15,23,42,0.9))] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.28)] sm:p-6">
        <div className="absolute -left-10 top-0 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-28 w-28 rounded-full bg-rose-300/10 blur-3xl" />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              {t('usuariosSectionEyebrow')}
            </p>
            <h2 className="text-2xl font-semibold text-white">
              {t('usuariosCount', { count: users.length })}
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-slate-400">
              {t('usuariosDesc')}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row">
          <label className="flex flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
            <Search size={16} className="text-cyan-300" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('buscarUsuarioPlaceholder')}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>

          <label className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
            <Filter size={16} className="text-slate-400" />
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
              className="bg-transparent text-sm text-white outline-none"
            >
              <option value="all" className="bg-slate-950">{t('usuariosRoleFilterAll')}</option>
              <option value="admin" className="bg-slate-950">{t('usuariosRoleFilterAdmin')}</option>
              <option value="equipo" className="bg-slate-950">{t('usuariosRoleFilterEquipo')}</option>
              <option value="espectador" className="bg-slate-950">{t('usuariosRoleFilterEspectador')}</option>
            </select>
          </label>
        </div>
      </div>

      {fetchError ? (
        <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {fetchError}
        </div>
      ) : null}

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border border-emerald-400/25 bg-emerald-500/10 text-emerald-100'
              : 'border border-red-400/25 bg-red-500/10 text-red-100'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {users.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-white/12 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(7,11,22,0.94))] px-6 py-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-300">
            <Users size={24} />
          </div>
          <h3 className="mt-4 text-xl font-semibold text-white">
            {t('usuariosNoRegistrados')}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
            {t('usuariosEmptyDesc')}
          </p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(7,11,22,0.94))] px-6 py-10 text-center">
          <p className="text-base font-semibold text-white">
            {t('usuariosNoResultados')}
          </p>
          <p className="mt-2 text-sm text-slate-400">
            {t('usuariosNoResultadosDesc')}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(7,11,22,0.98))] shadow-[0_24px_70px_rgba(2,6,23,0.32)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10">
              <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-semibold">{t('usuariosColNombre')}</th>
                  <th className="px-6 py-4 font-semibold">{t('usuariosColRol')}</th>
                  <th className="px-6 py-4 font-semibold">{t('usuariosColEquipo')}</th>
                  <th className="px-6 py-4 font-semibold">{t('usuariosColAlta')}</th>
                  <th className="px-6 py-4 text-right font-semibold">{t('usuariosColAcciones')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 text-sm text-slate-200">
                {filteredUsers.map((user) => {
                  const isCurrentUser = user.id === currentUserId;
                  const hasTeam = Boolean(user.equipo);
                  const isSaving = savingUserId === user.id;
                  const isDeleting = deletingUserId === user.id;
                  const isBusy = isSaving || isDeleting;
                  const deleteDisabled = isCurrentUser || hasTeam || isBusy;
                  const deleteTitle = isCurrentUser
                    ? t('usuarioNoEliminable')
                    : hasTeam
                      ? t('usuarioDeleteBlockedHint', { equipo: user.equipo?.nombre ?? '' })
                      : undefined;

                  return (
                    <tr key={user.id} className="align-top">
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white">{user.nombre}</p>
                            {isCurrentUser ? (
                              <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-100">
                                {t('usuarioSesionActual')}
                              </span>
                            ) : null}
                          </div>
                          <p className="text-sm text-slate-400">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={user.rol}
                          disabled={isCurrentUser || isBusy}
                          title={isCurrentUser ? t('usuarioNoEditable') : undefined}
                          onChange={(event) => void handleRoleChange(user, event.target.value as UserResponse['rol'])}
                          className="min-w-40 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role} className="bg-slate-950">
                              {getRoleLabel(role, t)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {user.equipo ? (
                          <div className="space-y-1">
                            <p className="font-medium text-white">{user.equipo.nombre}</p>
                            <p className="font-mono text-xs text-slate-500">{user.equipo.agentId}</p>
                          </div>
                        ) : (
                          <span className="text-slate-500">{t('usuarioSinEquipo')}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-400">{formatDate(user.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <button
                            type="button"
                            title={deleteTitle}
                            disabled={deleteDisabled}
                            onClick={() => void handleDelete(user)}
                            className="inline-flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-300/10 px-4 py-2 text-sm font-semibold text-rose-100 transition-colors hover:bg-rose-300/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                            {isDeleting ? t('usuarioEliminando') : t('usuarioEliminar')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(7,11,22,0.94))] p-5">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/15"
          style={{ background: `${accent}1f`, color: accent }}
        >
          {icon}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
