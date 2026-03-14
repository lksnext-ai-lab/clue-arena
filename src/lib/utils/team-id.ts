export function slugifyTeamId(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 50);
}

export function resolveTeamId(teamId: string | undefined, teamName: string): string {
  const normalized = slugifyTeamId(teamId?.trim() || teamName);
  return normalized || 'team';
}
