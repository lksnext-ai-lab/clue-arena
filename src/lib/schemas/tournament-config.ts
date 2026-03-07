// src/lib/schemas/tournament-config.ts
import { z } from 'zod';

const maxTurnosPorPartidaField = z.number().int().min(1).optional();

export const RoundRobinConfigSchema = z.object({
  totalRounds:          z.number().int().min(3).max(10),
  playersPerGame:       z.number().int().min(2).max(6).default(6),
  maxTurnosPorPartida:  maxTurnosPorPartidaField,
});

export const SingleBracketConfigSchema = z.object({
  playersPerGame:       z.number().int().min(2).max(6).default(2),
  maxTurnosPorPartida:  maxTurnosPorPartidaField,
  // byes are calculated automatically
});

export const GroupStageConfigSchema = z.object({
  numGroups:            z.number().int().min(2).max(4),
  advancePerGroup:      z.number().int().min(1).max(4),
  groupRounds:          z.number().int().min(1).max(6),
  playersPerGame:       z.number().int().min(2).max(6).default(6),
  maxTurnosPorPartida:  maxTurnosPorPartidaField,
});

export const CustomConfigSchema = z.object({
  details:              z.string().optional(),
  maxTurnosPorPartida:  maxTurnosPorPartidaField,
});

export const TournamentConfigSchema = z.discriminatedUnion('format', [
  z.object({ format: z.literal('round_robin'),    ...RoundRobinConfigSchema.shape }),
  z.object({ format: z.literal('single_bracket'), ...SingleBracketConfigSchema.shape }),
  z.object({ format: z.literal('group_stage'),    ...GroupStageConfigSchema.shape }),
  z.object({ format: z.literal('custom'),          ...CustomConfigSchema.shape }),
]);

export type TournamentConfig = z.infer<typeof TournamentConfigSchema>;

// ── Create / Update schemas ────────────────────────────────────────────────

export const CreateTournamentSchema = z.object({
  name:   z.string().min(1).max(120),
  config: TournamentConfigSchema,
});

export const UpdateTournamentSchema = z.object({
  name:   z.string().min(1).max(120).optional(),
  config: TournamentConfigSchema.optional(),
});

export const EnrollTeamsSchema = z.object({
  teamIds: z.array(z.string().min(1)).min(1),
  seeds:   z.record(z.string(), z.number().int().positive()).optional(), // teamId → seed
});
