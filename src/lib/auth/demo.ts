export const DEMO_PASSWORD = 'sample';

export type DemoSeedUser = {
  id: string;
  email: string;
  name: string;
  rol: 'admin' | 'equipo' | 'espectador';
};

export const DEMO_USERS: readonly DemoSeedUser[] = [
  {
    id: 'demo-admin-id',
    email: 'admin@arena-demo.local',
    name: 'Demo Admin',
    rol: 'admin',
  },
  {
    id: 'demo-equipo-id',
    email: 'equipo@arena-demo.local',
    name: 'Demo Equipo',
    rol: 'equipo',
  },
  {
    id: 'demo-espectador-id',
    email: 'espectador@arena-demo.local',
    name: 'Demo Espectador',
    rol: 'espectador',
  },
] as const;

const DEMO_EMAILS = new Set(DEMO_USERS.map((user) => user.email.toLowerCase()));

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true';
}

export function isDemoEmail(email: string): boolean {
  return DEMO_EMAILS.has(email.trim().toLowerCase());
}
