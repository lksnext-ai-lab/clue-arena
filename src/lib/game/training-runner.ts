import { runTrainingGameLoop, type TrainingLoopOptions } from './training-loop';
import { db } from '@/lib/db';
import { partidasEntrenamiento } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

class TrainingRunner {
  private readonly loops = new Map<string, AbortController>();

  isRunning(gameId: string): boolean {
    return this.loops.has(gameId);
  }

  start(options: TrainingLoopOptions): boolean {
    if (this.loops.has(options.gameId)) return false;

    const ac = new AbortController();
    this.loops.set(options.gameId, ac);

    void runTrainingGameLoop(options, ac.signal)
      .catch(async (error) => {
        await db
          .update(partidasEntrenamiento)
          .set({
            estado: 'abortada',
            motivoAbort: error instanceof Error ? error.message : 'unknown',
            finishedAt: new Date(),
          })
          .where(eq(partidasEntrenamiento.id, options.gameId))
          .catch(() => {});
      })
      .finally(() => {
        this.loops.delete(options.gameId);
      });

    return true;
  }

  stop(gameId: string): boolean {
    const ac = this.loops.get(gameId);
    if (!ac) return false;
    ac.abort();
    return true;
  }
}

const RUNNER_KEY = Symbol.for('clue-arena.trainingRunner');

type GlobalWithTrainingRunner = typeof globalThis & {
  [key: symbol]: TrainingRunner;
};

if (!(globalThis as GlobalWithTrainingRunner)[RUNNER_KEY]) {
  (globalThis as GlobalWithTrainingRunner)[RUNNER_KEY] = new TrainingRunner();
}

export const trainingRunner: TrainingRunner =
  (globalThis as GlobalWithTrainingRunner)[RUNNER_KEY];
