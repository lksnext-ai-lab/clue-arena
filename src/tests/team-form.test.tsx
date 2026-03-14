import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { CreateTeamForm } from '@/components/admin/CreateTeamForm';

// stub translations: return key so we can query by it
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));

describe('team forms UI', () => {
  it('hides appId and API key inputs when backend is set to local', () => {
    render(<CreateTeamForm onCreated={() => {}} onCancel={() => {}} />);

    const backendSelect = screen.getByRole('combobox') as HTMLSelectElement;
    // initially mattin: placeholders should be present
    expect(screen.getByPlaceholderText('appIdPlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('mattinApiKeyPlaceholder')).toBeInTheDocument();

    // switch to local
    fireEvent.change(backendSelect, { target: { value: 'local' } });
    expect(screen.queryByPlaceholderText('appIdPlaceholder')).toBeNull();
    expect(screen.queryByPlaceholderText('mattinApiKeyPlaceholder')).toBeNull();

    // ensure switching back shows them again
    fireEvent.change(backendSelect, { target: { value: 'mattin' } });
    expect(screen.getByPlaceholderText('appIdPlaceholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('mattinApiKeyPlaceholder')).toBeInTheDocument();
  });
});
