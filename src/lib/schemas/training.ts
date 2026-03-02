import { z } from 'zod';

export const CreateTrainingGameSchema = z.object({
  numBots: z.number().int().min(1).max(5).default(2),
  seed:    z.string().optional(),
});

export type CreateTrainingGameInput = z.infer<typeof CreateTrainingGameSchema>;
