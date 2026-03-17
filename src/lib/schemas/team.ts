import { z } from 'zod';

const emailList = z
  .array(z.string().email('Debe ser un email válido'))
  .max(20, 'El equipo no puede tener más de 20 miembros')
  .optional()
  .default([]);

const optionalInputString = (message: string) => z.preprocess(
  v => (v === '' ? undefined : v),
  z.string().min(1, message).optional()
);

const optionalNullableInputString = (message: string) => z.preprocess(
  v => (v === '' ? undefined : v),
  z.string().min(1, message).nullable().optional()
);

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
  descripcion: z.preprocess(
    v => (v === '' ? undefined : v),
    z.string().max(300, 'La descripción no puede superar 300 caracteres').optional()
  ),
  agentId: optionalInputString('El agent_id no puede estar vacío'),
  agentBackend: z.enum(['mattin', 'local']).default('mattin'),
  // appId and mattinApiKey are only required when the backend is MattinAI.  
  // they may be omitted or empty while using the local Genkit backend.
  appId: optionalInputString('El app_id no puede estar vacío'),
  mattinApiKey: z.preprocess(v => (v === '' ? undefined : v),
    z.string().min(1, 'La API key no puede estar vacía').optional()),
  miembros: emailList,
  usuarioId: z.string().min(1).optional(),
  estado: z.enum(['activo', 'inactivo']).default('activo'),
}).superRefine((data, ctx) => {
  if (data.agentBackend === 'mattin') {
    if (!data.agentId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['agentId'],
        message: 'El agent_id es requerido',
      });
    }
    if (!data.appId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['appId'],
        message: 'El app_id es requerido',
      });
    }
    if (!data.mattinApiKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['mattinApiKey'],
        message: 'La API key es requerida',
      });
    }
  }
});

export type TeamRegistrationInput = z.infer<typeof TeamRegistrationSchema>;


export const UpdateTeamSchema = z.object({
  nombre: z.string().min(3).max(50).optional(),
  descripcion: z.string().max(300).nullable().optional(),
  agentId: optionalInputString('El agent_id no puede estar vacío'),
  agentBackend: z.enum(['mattin', 'local']).optional(),
  appId: optionalNullableInputString('El app_id no puede estar vacío'),
  mattinApiKey: z.preprocess(v => (v === '' ? undefined : v), z.string().min(1).optional()),
  avatarUrl: z.string().nullable().optional(),
  estado: z.enum(['activo', 'inactivo']).optional(),
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
  agentId: optionalInputString('El agent_id es requerido'),
  agentBackend: z.enum(['mattin', 'local']).optional(),
  appId: optionalNullableInputString('El app_id no puede estar vacío'),
  mattinApiKey: z.preprocess(v => (v === '' ? undefined : v), z.string().min(1).optional()),
});

export type TeamMemberUpdateInput = z.infer<typeof TeamMemberUpdateSchema>;


export const GenerateAvatarSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
});

export type GenerateAvatarInput = z.infer<typeof GenerateAvatarSchema>;
