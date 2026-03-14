import { z } from 'zod';

const emailList = z
  .array(z.string().email('Debe ser un email válido'))
  .max(20, 'El equipo no puede tener más de 20 miembros')
  .optional()
  .default([]);

export const TeamRegistrationSchema = z.object({
  id: z
    .string()
    .trim()
    .min(3, 'El team_id debe tener al menos 3 caracteres')
    .max(50, 'El team_id no puede superar 50 caracteres')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Usa minúsculas, números y guiones')
    .optional()
    .or(z.literal('')),
  nombre: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(50, 'El nombre no puede superar 50 caracteres')
    .regex(/^[\w\s\-áéíóúÁÉÍÓÚñÑüÜ]+$/, 'Solo se permiten letras, números, espacios y guiones'),
  agentId: z.string().min(1, 'El agent_id es requerido'),
  agentBackend: z.enum(['mattin', 'local']).default('mattin'),
  // appId and mattinApiKey are only required when the backend is MattinAI.  
  // they may be omitted or empty while using the local Genkit backend.
  appId: z
    .string()
    .min(1, 'El app_id no puede estar vacío')
    .optional(),
  mattinApiKey: z.preprocess(v => (v === '' ? undefined : v),
    z.string().min(1, 'La API key no puede estar vacía').optional()),
  miembros: emailList,
});

export type TeamRegistrationInput = z.infer<typeof TeamRegistrationSchema>;


export const UpdateTeamSchema = z.object({
  nombre: z.string().min(3).max(50).optional(),
  descripcion: z.string().max(300).nullable().optional(),
  agentId: z.string().min(1).optional(),
  agentBackend: z.enum(['mattin', 'local']).optional(),
  appId: z.string().min(1).nullable().optional(),
  mattinApiKey: z.preprocess(v => (v === '' ? undefined : v), z.string().min(1).optional()),
  avatarUrl: z.string().nullable().optional(),
  estado: z.enum(['registrado', 'activo', 'finalizado']).optional(),
  miembros: emailList,
  usuarioId: z.string().min(1).optional(),
});

export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>;


export const UpdateMembersSchema = z.object({
  miembros: z
    .array(z.string().email('Debe ser un email válido'))
    .max(20, 'El equipo no puede tener más de 20 miembros'),
});

export type UpdateMembersInput = z.infer<typeof UpdateMembersSchema>;

/** Fields a team member (owner) is allowed to edit on their own team. */
export const TeamMemberUpdateSchema = z.object({
  nombre: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(50, 'El nombre no puede superar 50 caracteres')
    .regex(/^[\w\s\-áéíóúÁÉÍÓÚñÑüÜ]+$/, 'Solo se permiten letras, números, espacios y guiones')
    .optional(),
  descripcion: z.string().max(300).nullable().optional(),
  agentId: z.string().min(1, 'El agent_id es requerido').optional(),
  agentBackend: z.enum(['mattin', 'local']).optional(),
  appId: z.string().min(1).nullable().optional(),
  mattinApiKey: z.preprocess(v => (v === '' ? undefined : v), z.string().min(1).optional()),
});

export type TeamMemberUpdateInput = z.infer<typeof TeamMemberUpdateSchema>;


export const GenerateAvatarSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
});

export type GenerateAvatarInput = z.infer<typeof GenerateAvatarSchema>;
