import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '@/components/layout/Sidebar';

const usePathnameMock = vi.fn();
const useAppSessionMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/contexts/SessionContext', () => ({
  useAppSession: () => useAppSessionMock(),
}));

vi.mock('@/components/layout/LocaleSwitcher', () => ({
  LocaleSwitcher: () => <div data-testid="locale-switcher" />,
}));

describe('Sidebar', () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue('/');
    useAppSessionMock.mockReturnValue({
      rol: 'equipo',
      equipo: {
        id: 'team-alpha',
        nombre: 'Equipo Alpha',
        agentId: 'agent-alpha',
      },
    });
  });

  it('shows training navigation when the user has a team', () => {
    render(<Sidebar />);

    expect(screen.getByText('entrenamiento')).toBeInTheDocument();
  });

  it('hides training navigation when the user has no team', () => {
    useAppSessionMock.mockReturnValue({
      rol: 'equipo',
      equipo: null,
    });

    render(<Sidebar />);

    expect(screen.queryByText('entrenamiento')).not.toBeInTheDocument();
  });

  it('shows user management navigation for admins', () => {
    useAppSessionMock.mockReturnValue({
      rol: 'admin',
      equipo: null,
    });

    render(<Sidebar />);

    expect(screen.getByText('usuarios')).toBeInTheDocument();
    expect(screen.getByText('equipos')).toBeInTheDocument();
  });
});
