import { z } from 'zod';

export const CreateGameSchema = z.object({
  nombre: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  equipoIds: z
    .array(z.string())
    .min(2, 'Se necesitan al menos 2 equipos')
    .max(6, 'Máximo 6 equipos por partida'),
});

export type CreateGameInput = z.infer<typeof CreateGameSchema>;
