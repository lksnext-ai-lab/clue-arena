/**
 * Unit tests for the local Genkit agent backend.
 * Mocks ai.generate — no real LLM calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Genkit ai instance before importing local-agent
vi.mock('@/lib/ai/genkit', () => ({
  ai: { generate: vi.fn(), defineTool: vi.fn((config, handler) => ({ ...config, handler })) },
  DEFAULT_MODEL: 'test-model',
}));

// Mock the tools module to avoid DB/MCP dependencies
vi.mock('@/lib/ai/tools/cluedo-tools', () => ({
  PLAY_TURN_TOOLS: [],
  REFUTE_TOOLS: [],
}));

// Mock MCP tool wrappers and context to avoid DB/logger/pino dependencies
vi.mock('@/lib/mcp/tools/context', () => ({
  createMcpCallContext: vi.fn(() => ({ invocacionId: 'test', gameId: 'g1', teamId: 't1', turnoId: 'tr1', nextSequence: () => 1 })),
  mcpContextStorage: { run: vi.fn((_ctx: unknown, fn: () => unknown) => fn()) },
}));
vi.mock('@/lib/mcp/tools/_log-wrapper', () => ({
  withMcpLog: vi.fn((_name: string, handler: (...args: unknown[]) => unknown) => handler),
}));
vi.mock('@/lib/mcp/tools/get-game-state', () => ({
  getGameStateTool: {
    handler: vi.fn().mockResolvedValue({ content: [{ text: '{}' }] }),
    schema: {},
  },
}));
vi.mock('@/lib/ai/agent-memory', () => ({
  getAgentMemory: vi.fn().mockResolvedValue({}),
  saveAgentMemory: vi.fn().mockResolvedValue(undefined),
}));

const TEST_OPTIONS = { invocacionId: 'test-invocation-id', turnoId: 'test-turno-id' };

import { invokeAgent, AgentResponseError } from '@/lib/api/local-agent';
import { ai } from '@/lib/ai/genkit';

const mockGenerate = vi.mocked(ai.generate);

/** Builds a minimal fake Genkit GenerateResponse */
function fakeResponse(outputJson: unknown) {
  return {
    output: outputJson,
    messages: [
      {
        role: 'model',
        content: [{ text: JSON.stringify(outputJson) }],
      },
    ],
  };
}

describe('invokeAgent — play_turn', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  it('returns suggestion action when LLM outputs suggestion', async () => {
    const expected = {
      action: { type: 'suggestion', suspect: 'Mustard', weapon: 'Wrench', room: 'Library' },
    };
    mockGenerate.mockResolvedValueOnce(fakeResponse(expected) as never);

    const result = await invokeAgent({ type: 'play_turn', gameId: 'g1', teamId: 't1' }, TEST_OPTIONS);

    expect(result.action.type).toBe('suggestion');
    expect(result.done).toBe(true);
    expect(result.reasoning).toBeTruthy();
  });

  it('returns accusation action when LLM outputs accusation', async () => {
    const expected = {
      action: { type: 'accusation', suspect: 'Plum', weapon: 'Candlestick', room: 'Ballroom' },
    };
    mockGenerate.mockResolvedValueOnce(fakeResponse(expected) as never);

    const result = await invokeAgent({ type: 'play_turn', gameId: 'g1', teamId: 't1' }, TEST_OPTIONS);

    expect(result.action.type).toBe('accusation');
  });

  it('throws AgentResponseError when LLM returns invalid JSON structure', async () => {
    mockGenerate.mockResolvedValueOnce(fakeResponse({ action: { type: 'invalid' } }) as never);

    await expect(
      invokeAgent({ type: 'play_turn', gameId: 'g1', teamId: 't1' }, TEST_OPTIONS)
    ).rejects.toThrow(AgentResponseError);
  });

  it('throws AgentResponseError when LLM returns no action field', async () => {
    mockGenerate.mockResolvedValueOnce(fakeResponse({ foo: 'bar' }) as never);

    await expect(
      invokeAgent({ type: 'play_turn', gameId: 'g1', teamId: 't1' }, TEST_OPTIONS)
    ).rejects.toThrow(AgentResponseError);
  });
});

describe('invokeAgent — refute', () => {
  beforeEach(() => {
    mockGenerate.mockReset();
  });

  it('returns show_card action when LLM outputs show_card', async () => {
    const expected = { action: { type: 'show_card', card: 'Mustard' } };
    mockGenerate.mockResolvedValueOnce(fakeResponse(expected) as never);

    const result = await invokeAgent({
      type: 'refute',
      gameId: 'g1',
      teamId: 't1',
      suspect: 'Mustard',
      weapon: 'Wrench',
      room: 'Library',
    }, TEST_OPTIONS);

    expect(result.action.type).toBe('show_card');
    if (result.action.type === 'show_card') {
      expect(result.action.card).toBe('Mustard');
    }
  });

  it('returns cannot_refute action when LLM outputs cannot_refute', async () => {
    const expected = { action: { type: 'cannot_refute' } };
    mockGenerate.mockResolvedValueOnce(fakeResponse(expected) as never);

    const result = await invokeAgent({
      type: 'refute',
      gameId: 'g1',
      teamId: 't1',
      suspect: 'Green',
      weapon: 'Rope',
      room: 'Kitchen',
    }, TEST_OPTIONS);

    expect(result.action.type).toBe('cannot_refute');
  });

  it('throws AgentResponseError when LLM returns suggestion for a refute request', async () => {
    const expected = {
      action: { type: 'suggestion', suspect: 'Plum', weapon: 'Lead Pipe', room: 'Study' },
    };
    mockGenerate.mockResolvedValueOnce(fakeResponse(expected) as never);

    await expect(
      invokeAgent({
        type: 'refute',
        gameId: 'g1',
        teamId: 't1',
        suspect: 'Plum',
        weapon: 'Lead Pipe',
        room: 'Study',
      }, TEST_OPTIONS)
    ).rejects.toThrow(AgentResponseError);
  });
});
