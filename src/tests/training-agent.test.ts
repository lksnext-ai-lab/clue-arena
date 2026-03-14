/**
 * Unit tests for training-agent.ts — invokeAgentWithTrace.
 * Covers local (Genkit) and mattin backend paths.
 * No real LLM or network calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/ai/genkit', () => ({
  ai: { generate: vi.fn() },
  DEFAULT_MODEL: 'test-model',
}));

vi.mock('@/lib/ai/agent-memory', () => ({
  getAgentMemory: vi.fn().mockResolvedValue({ clues: [] }),
  saveAgentMemory: vi.fn().mockResolvedValue(undefined),
}));

// Mattin client mock — returned from dynamic import('./mattin')
const mockMattinInvokeAgent = vi.fn();
vi.mock('@/lib/api/mattin', () => ({
  invokeAgent: mockMattinInvokeAgent,
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────
import { invokeAgentWithTrace, TrainingAgentError } from '@/lib/api/training-agent';
import { ai } from '@/lib/ai/genkit';

const mockGenerate = vi.mocked(ai.generate);

/** Builds a minimal fake Genkit GenerateResponse */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeGenkitResponse(outputJson: unknown): any {
  return {
    output: outputJson,
    toolRequests: [],
    finishReason: 'stop',
    usage: {},
    messages: [{ role: 'model', content: [{ text: JSON.stringify(outputJson) }] }],
  };
}

const PLAY_TURN_REQUEST = {
  agentRequest: { type: 'play_turn' as const, gameId: 'g-train-01', teamId: 't-01' },
  gameStateJson: JSON.stringify({ gameId: 'g-train-01', estado: 'en_curso' }),
};

const REFUTE_REQUEST = {
  agentRequest: {
    type: 'refute' as const,
    gameId: 'g-train-01',
    teamId: 't-01',
    suspect: 'Scarlett',
    weapon: 'Rope',
    room: 'Kitchen',
  },
  gameStateJson: JSON.stringify({ gameId: 'g-train-01', estado: 'en_curso' }),
};

// ── Local backend tests ────────────────────────────────────────────────────

describe('invokeAgentWithTrace — local backend (default)', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  it('returns trace with backendType=local for a suggestion play_turn', async () => {
    mockGenerate.mockResolvedValue(
      fakeGenkitResponse({ action: { type: 'suggestion', suspect: 'Scarlett', weapon: 'Rope', room: 'Kitchen' } }),
    );

    const result = await invokeAgentWithTrace(PLAY_TURN_REQUEST);

    expect(result.trace.backendType).toBe('local');
    expect(result.trace.type).toBe('play_turn');
    expect(result.agentResponse.action.type).toBe('suggestion');
    expect(result.trace.exchanges).toHaveLength(1);
    // Local path: synthetic tool calls for context-injection are recorded
    expect(result.trace.exchanges[0].toolCalls.length).toBeGreaterThan(0);
    expect(result.memoriaInicial).toBeDefined();
    expect(result.memoriaFinal).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns trace with backendType=local for a refute turn', async () => {
    mockGenerate.mockResolvedValue(
      fakeGenkitResponse({ action: { type: 'show_card', card: 'Rope' } }),
    );

    const result = await invokeAgentWithTrace(REFUTE_REQUEST);

    expect(result.trace.backendType).toBe('local');
    expect(result.trace.type).toBe('refute');
    expect(result.agentResponse.action.type).toBe('show_card');
  });

  it('throws TrainingAgentError with local trace when LLM fails', async () => {
    mockGenerate.mockRejectedValue(new Error('LLM timeout'));

    await expect(invokeAgentWithTrace(PLAY_TURN_REQUEST)).rejects.toThrow(TrainingAgentError);

    try {
      await invokeAgentWithTrace(PLAY_TURN_REQUEST);
    } catch (err) {
      if (err instanceof TrainingAgentError) {
        expect(err.trace.backendType).toBe('local');
        expect(err.trace.parseError).toContain('LLM timeout');
      }
    }
  });

  it('throws TrainingAgentError when LLM output fails Zod validation', async () => {
    mockGenerate.mockResolvedValue(fakeGenkitResponse({ action: { type: 'unknown_action' } }));

    await expect(invokeAgentWithTrace(PLAY_TURN_REQUEST)).rejects.toThrow(TrainingAgentError);
  });
});

// ── Mattin backend tests ───────────────────────────────────────────────────

describe('invokeAgentWithTrace — mattin backend', () => {
  beforeEach(() => {
    mockMattinInvokeAgent.mockReset();
  });

  const MATTIN_OPTIONS = {
    agentBackend: 'mattin' as const,
    mattinAgentId: 'agent-123',
    mattinAppId: 'app-456',
    mattinApiKey: 'key-abc',
  };

  it('returns trace with backendType=mattin for a suggestion play_turn', async () => {
    const mattinResponse = {
      action: { type: 'suggestion', suspect: 'Scarlett', weapon: 'Rope', room: 'Kitchen' },
      reasoning: 'I deduce it was Scarlett.',
      done: true,
    };
    mockMattinInvokeAgent.mockResolvedValue(mattinResponse);

    const result = await invokeAgentWithTrace({ ...PLAY_TURN_REQUEST, ...MATTIN_OPTIONS });

    expect(result.trace.backendType).toBe('mattin');
    expect(result.trace.type).toBe('play_turn');
    expect(result.agentResponse.action.type).toBe('suggestion');
    expect(result.trace.exchanges).toHaveLength(1);
    // Mattin path: no internal tool calls observable on this side
    expect(result.trace.exchanges[0].toolCalls).toHaveLength(0);
    expect(result.trace.totalToolCalls).toBe(0);
  });

  it('passes mattinAgentId, mattinAppId and mattinApiKey through to mattin.invokeAgent', async () => {
    const mattinResponse = {
      action: { type: 'pass' },
      reasoning: 'pass',
      done: true,
    };
    mockMattinInvokeAgent.mockResolvedValue(mattinResponse);

    await invokeAgentWithTrace({ ...PLAY_TURN_REQUEST, ...MATTIN_OPTIONS });

    expect(mockMattinInvokeAgent).toHaveBeenCalledWith(
      PLAY_TURN_REQUEST.agentRequest,
      expect.objectContaining({
        agentId: 'agent-123',
        appId:   'app-456',
        apiKey:  'key-abc',
      }),
    );
  });

  it('throws TrainingAgentError with mattin trace when mattin.invokeAgent rejects', async () => {
    mockMattinInvokeAgent.mockRejectedValue(new Error('MattinAI API error: 500'));

    await expect(
      invokeAgentWithTrace({ ...PLAY_TURN_REQUEST, ...MATTIN_OPTIONS }),
    ).rejects.toThrow(TrainingAgentError);

    try {
      await invokeAgentWithTrace({ ...PLAY_TURN_REQUEST, ...MATTIN_OPTIONS });
    } catch (err) {
      if (err instanceof TrainingAgentError) {
        expect(err.trace.backendType).toBe('mattin');
        expect(err.trace.parseError).toContain('500');
      }
    }
  });

  it('captures memoriaInicial and memoriaFinal from agent-memory regardless of backend', async () => {
    const mattinResponse = { action: { type: 'pass' }, reasoning: '', done: true };
    mockMattinInvokeAgent.mockResolvedValue(mattinResponse);

    const result = await invokeAgentWithTrace({ ...PLAY_TURN_REQUEST, ...MATTIN_OPTIONS });

    // getAgentMemory was called for both initial and final snapshots
    expect(result.memoriaInicial).toEqual({ clues: [] });
    expect(result.memoriaFinal).toEqual({ clues: [] });
  });
});
