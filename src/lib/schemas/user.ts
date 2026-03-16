import { z } from 'zod';

export const UpdateUserSchema = z.object({
  nombre: z.string().trim().min(1).max(100).optional(),
  rol: z.enum(['admin', 'equipo', 'espectador']).optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
