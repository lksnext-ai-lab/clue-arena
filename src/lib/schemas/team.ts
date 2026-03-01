import { z } from 'zod';

const emailList = z
  .array(z.string().email('Debe ser un email válido'))
  .max(20, 'El equipo no puede tener más de 20 miembros')
  .optional()
  .default([]);

export const TeamRegistrationSchema = z.object({
  nombre: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(50, 'El nombre no puede superar 50 caracteres')
    .regex(/^[\w\s\-áéíóúÁÉÍÓÚñÑüÜ]+$/, 'Solo se permiten letras, números, espacios y guiones'),
  agentId: z.string().min(1, 'El agent_id es requerido'),
  miembros: emailList,
});

export type TeamRegistrationInput = z.infer<typeof TeamRegistrationSchema>;

export const UpdateTeamSchema = z.object({
  nombre: z.string().min(3).max(50).optional(),
  descripcion: z.string().max(300).nullable().optional(),
  agentId: z.string().min(1).optional(),
  avatarUrl: z.string().nullable().optional(),
  estado: z.enum(['registrado', 'activo', 'finalizado']).optional(),
  miembros: emailList,
});

export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>;

export const UpdateMembersSchema = z.object({
  miembros: z
    .array(z.string().email('Debe ser un email válido'))
    .max(20, 'El equipo no puede tener más de 20 miembros'),
});

export type UpdateMembersInput = z.infer<typeof UpdateMembersSchema>;

export const GenerateAvatarSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
});

export type GenerateAvatarInput = z.infer<typeof GenerateAvatarSchema>;
