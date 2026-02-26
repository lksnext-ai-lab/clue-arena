import type { Metadata } from 'next';
import { JuegoHeroBanner } from '@/components/game/juego/JuegoHeroBanner';
import { JuegoObjetivos } from '@/components/game/juego/JuegoObjetivos';
import { JuegoQueEsCluedo } from '@/components/game/juego/JuegoQueEsCluedo';
import { JuegoMecanica } from '@/components/game/juego/JuegoMecanica';
import { JuegoPersonajes } from '@/components/game/juego/JuegoPersonajes';
import { JuegoArmas } from '@/components/game/juego/JuegoArmas';
import { JuegoEscenarios } from '@/components/game/juego/JuegoEscenarios';

export const metadata: Metadata = {
  title: 'El Juego — Clue Arena',
  description:
    'Contexto, personajes, armas, escenarios, mecánica de juego y objetivos del evento Clue Arena.',
};

/**
 * Static Server Component — no API calls, no polling.
 * All data comes from domain constants and curated event text.
 */
export default function JuegoPage() {
  return (
    <main className="flex flex-col gap-10 p-6 max-w-7xl mx-auto w-full pb-16">
      <JuegoHeroBanner />
      <JuegoObjetivos />
      <JuegoQueEsCluedo />
      <JuegoMecanica />
      <JuegoPersonajes />
      <JuegoArmas />
      <JuegoEscenarios />
    </main>
  );
}
