import { z } from 'zod';

export const TeamRegistrationSchema = z.object({
  nombre: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(50, 'El nombre no puede superar 50 caracteres')
    .regex(/^[\w\s\-áéíóúÁÉÍÓÚñÑüÜ]+$/, 'Solo se permiten letras, números, espacios y guiones'),
  agentId: z.string().min(1, 'El agent_id es requerido'),
});

export type TeamRegistrationInput = z.infer<typeof TeamRegistrationSchema>;

export const UpdateTeamSchema = z.object({
  nombre: z.string().min(3).max(50).optional(),
  descripcion: z.string().max(300).nullable().optional(),
  agentId: z.string().min(1).optional(),
  avatarUrl: z.string().nullable().optional(),
  estado: z.enum(['registrado', 'activo', 'finalizado']).optional(),
});

export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>;

export const GenerateAvatarSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
});

export type GenerateAvatarInput = z.infer<typeof GenerateAvatarSchema>;
