/**
 * Unit tests for F012 — withMcpLog wrapper and McpCallContext.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock logger before importing anything that uses it ────────────────────────
// Use vi.hoisted so the mocks are available before the module factory runs
const { mockMcpLogInfo, mockMcpLogWarn } = vi.hoisted(() => ({
  mockMcpLogInfo: vi.fn(),
  mockMcpLogWarn: vi.fn(),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), child: vi.fn() },
  agentLog: { info: vi.fn(), warn: vi.fn() },
  mcpLog: { info: mockMcpLogInfo, warn: mockMcpLogWarn },
}));

// Mock crypto utility
vi.mock('@/lib/utils/crypto', () => ({
  hashSHA256: vi.fn((s: string) => `sha256:mock-${s.length}`),
}));

import { withMcpLog } from '@/lib/mcp/tools/_log-wrapper';
import {
  createMcpCallContext,
  McpToolLimitExceededError,
  MAX_TOOL_CALLS_PER_INVOCATION,
  mcpContextStorage,
} from '@/lib/mcp/tools/context';

describe('withMcpLog', () => {
  beforeEach(() => {
    mockMcpLogInfo.mockReset();
    mockMcpLogWarn.mockReset();
  });

  it('emits mcp_tool_call log on successful call', async () => {
    const ctx = createMcpCallContext('inv-1', 'game-1', 'team-1', 'turno-1');
    const handler = vi.fn().mockResolvedValue({ result: 'ok' });
    const wrapped = withMcpLog('test_tool', handler);

    await mcpContextStorage.run(ctx, () => wrapped({ arg: 'value' }));

    expect(mockMcpLogInfo).toHaveBeenCalledOnce();
    const entry = mockMcpLogInfo.mock.calls[0][0];
    expect(entry.event).toBe('mcp_tool_call');
    expect(entry.herramienta).toBe('test_tool');
    expect(entry.estado).toBe('ok');
    expect(entry.invocacionId).toBe('inv-1');
    expect(entry.gameId).toBe('game-1');
    expect(entry.teamId).toBe('team-1');
    expect(entry.turnoId).toBe('turno-1');
    expect(entry.secuencia).toBe(1);
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
    expect(entry.errorMessage).toBeNull();
    expect(entry.outputHash).toMatch(/^sha256:/);
  });

  it('emits mcp_tool_call with estado=error when handler throws', async () => {
    const ctx = createMcpCallContext('inv-2', 'game-2', 'team-2', 'turno-2');
    const handler = vi.fn().mockRejectedValue(new Error('handler failed'));
    const wrapped = withMcpLog('failing_tool', handler);

    await expect(
      mcpContextStorage.run(ctx, () => wrapped({ arg: 'x' })),
    ).rejects.toThrow('handler failed');

    expect(mockMcpLogInfo).toHaveBeenCalledOnce();
    const entry = mockMcpLogInfo.mock.calls[0][0];
    expect(entry.estado).toBe('error');
    expect(entry.errorMessage).toBe('handler failed');
    expect(entry.outputHash).toBeNull();
  });

  it('increments sequence counter across multiple calls', async () => {
    const ctx = createMcpCallContext('inv-3', 'game-3', 'team-3', 'turno-3');
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const wrapped = withMcpLog('counter_tool', handler);

    await mcpContextStorage.run(ctx, async () => {
      await wrapped({ n: 1 });
      await wrapped({ n: 2 });
      await wrapped({ n: 3 });
    });

    expect(mockMcpLogInfo).toHaveBeenCalledTimes(3);
    expect(mockMcpLogInfo.mock.calls[0][0].secuencia).toBe(1);
    expect(mockMcpLogInfo.mock.calls[1][0].secuencia).toBe(2);
    expect(mockMcpLogInfo.mock.calls[2][0].secuencia).toBe(3);
  });

  it('falls back gracefully when no context is set (sequence=0, unknown ids)', async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const wrapped = withMcpLog('no_ctx_tool', handler);

    // No mcpContextStorage.run — no context
    await wrapped({ arg: 'y' });

    const entry = mockMcpLogInfo.mock.calls[0][0];
    expect(entry.invocacionId).toBe('unknown');
    expect(entry.secuencia).toBe(0);
  });
});

describe('McpCallContext — tool call limit', () => {
  beforeEach(() => {
    mockMcpLogWarn.mockReset();
  });

  it(`throws McpToolLimitExceededError after ${MAX_TOOL_CALLS_PER_INVOCATION} calls`, () => {
    const ctx = createMcpCallContext('inv-limit', 'g', 't', 'tr');

    // Exhaust the limit
    for (let i = 0; i < MAX_TOOL_CALLS_PER_INVOCATION; i++) {
      ctx.nextSequence();
    }

    // Next call should throw
    expect(() => ctx.nextSequence()).toThrow(McpToolLimitExceededError);
  });

  it('emits mcp_tool_limit_exceeded warn log when limit is hit', () => {
    const ctx = createMcpCallContext('inv-warn', 'g', 't', 'tr');

    for (let i = 0; i < MAX_TOOL_CALLS_PER_INVOCATION; i++) {
      ctx.nextSequence();
    }

    try {
      ctx.nextSequence();
    } catch {
      // expected
    }

    expect(mockMcpLogWarn).toHaveBeenCalledOnce();
    const entry = mockMcpLogWarn.mock.calls[0][0];
    expect(entry.event).toBe('mcp_tool_limit_exceeded');
    expect(entry.invocacionId).toBe('inv-warn');
  });
});
