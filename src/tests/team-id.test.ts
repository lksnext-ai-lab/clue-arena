import { describe, expect, it } from 'vitest';
import { resolveTeamId, slugifyTeamId } from '@/lib/utils/team-id';

describe('team id helpers', () => {
  it('slugifies team names into safe ids', () => {
    expect(slugifyTeamId('Los Detectives Ñandú')).toBe('los-detectives-nandu');
  });

  it('uses the explicit team id when provided', () => {
    expect(resolveTeamId('equipo-alpha', 'Los Detectives')).toBe('equipo-alpha');
  });

  it('falls back to the team name when id is empty', () => {
    expect(resolveTeamId('', 'Los Detectives')).toBe('los-detectives');
  });
});
