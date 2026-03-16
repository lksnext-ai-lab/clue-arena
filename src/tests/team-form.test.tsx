import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CreateTeamForm } from '@/components/admin/CreateTeamForm';
import { apiFetch } from '@/lib/api/client';
import { EditTeamForm } from '@/components/team/EditTeamForm';
import type { TeamResponse } from '@/types/api';

// stub translations: return key so we can query by it
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/lib/api/client', () => ({ apiFetch: vi.fn() }));

describe('team forms UI', () => {
  const apiFetchMock = vi.mocked(apiFetch);
  const team: TeamResponse = {
    id: 'team-alpha',
    nombre: 'Equipo Alpha',
    descripcion: 'Descripcion',
    agentId: 'agent-alpha',
    agentBackend: 'mattin',
    appId: 'app-alpha',
    hasMattinApiKey: true,
    avatarUrl: null,
    usuarioId: 'user-1',
    estado: 'activo',
    miembros: [],
    createdAt: '2026-03-15T00:00:00.000Z',
  };

  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('shows owner selector in the admin create form', async () => {
    apiFetchMock.mockResolvedValueOnce({
      users: [{ id: 'user-1', nombre: 'Ada', email: 'ada@example.com', rol: 'equipo' }],
    });

    render(<CreateTeamForm onCreated={() => {}} onCancel={() => {}} />);

    expect(await screen.findAllByRole('combobox')).toHaveLength(3);
  });

  it('shows mattin fields and check action by default, then hides them for local', async () => {
    apiFetchMock.mockResolvedValueOnce({
      users: [{ id: 'user-1', nombre: 'Ada', email: 'ada@example.com', rol: 'equipo' }],
    });

    render(<CreateTeamForm onCreated={() => {}} onCancel={() => {}} />);

    const backendSelect = (await screen.findAllByRole('combobox'))[2] as HTMLSelectElement;
    expect(screen.getByPlaceholderText('Ej: agent-alpha-v2')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('appIdPlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('mattinApiKeyPlaceholder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'mattinCheckAction' })).toBeInTheDocument();

    fireEvent.change(backendSelect, { target: { value: 'local' } });
    expect(screen.queryByPlaceholderText('Ej: agent-alpha-v2')).toBeNull();
    expect(screen.queryByPlaceholderText('appIdPlaceholder')).toBeNull();
    expect(screen.queryByPlaceholderText('mattinApiKeyPlaceholder')).toBeNull();
    expect(screen.queryByRole('button', { name: 'mattinCheckAction' })).toBeNull();

    fireEvent.change(backendSelect, { target: { value: 'mattin' } });
    expect(screen.getByPlaceholderText('Ej: agent-alpha-v2')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('appIdPlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('mattinApiKeyPlaceholder')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'mattinCheckAction' })).toBeInTheDocument();
  });

  it('owner edit form follows the same mattin/local logic as admin edit', () => {
    render(
      <EditTeamForm
        team={team}
        onSaved={() => {}}
        onCancel={() => {}}
      />
    );

    const backendSelect = screen.getByRole('combobox') as HTMLSelectElement;
    expect(screen.getByPlaceholderText('agentIdPlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('appIdPlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('mattinApiKeyConfigured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'mattinCheckAction' })).toBeInTheDocument();

    fireEvent.change(backendSelect, { target: { value: 'local' } });
    expect(screen.queryByPlaceholderText('agentIdPlaceholder')).toBeNull();
    expect(screen.queryByPlaceholderText('appIdPlaceholder')).toBeNull();
    expect(screen.queryByPlaceholderText('mattinApiKeyConfigured')).toBeNull();
    expect(screen.queryByRole('button', { name: 'mattinCheckAction' })).toBeNull();
    expect(screen.queryByText('appIdLabel')).toBeNull();
    expect(screen.queryByText('editSecurityTitle')).toBeNull();

    fireEvent.change(backendSelect, { target: { value: 'mattin' } });
    expect(screen.getByPlaceholderText('agentIdPlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('appIdPlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('mattinApiKeyConfigured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'mattinCheckAction' })).toBeInTheDocument();
    expect(screen.getByText('editSecurityTitle')).toBeInTheDocument();
  });

  it('owner edit form can run the mattin connectivity check like admin edit', async () => {
    apiFetchMock.mockResolvedValueOnce({ reachable: true });

    render(
      <EditTeamForm
        team={team}
        onSaved={() => {}}
        onCancel={() => {}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'mattinCheckAction' }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
      expect(apiFetchMock).toHaveBeenCalledWith('/teams/check-mattin', {
        method: 'POST',
        body: JSON.stringify({
          agentId: team.agentId,
          appId: team.appId,
          mattinApiKey: '',
        }),
      });
      expect(screen.getByText('mattinCheckOk')).toBeInTheDocument();
    });
  });
});
