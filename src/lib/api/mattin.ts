/**
 * MattinAI client — server-side only.
 * Handles SSE streaming from the MattinAI API.
 */

export interface TurnResult {
  tokens: string[];
  toolCalls: ToolCall[];
  done: boolean;
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

interface SSEEvent {
  type: 'token' | 'tool_call' | 'tool_result' | 'done';
  content?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

export async function invokeTurn(
  agentId: string,
  context: string
): Promise<TurnResult> {
  const formData = new FormData();
  formData.append('message', context);

  const response = await fetch(
    `${process.env.MATTIN_API_URL}/public/v1/chat/${agentId}/call`,
    {
      method: 'POST',
      headers: {
        'X-API-Key': process.env.MATTIN_API_KEY!,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error(`MattinAI API error: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('MattinAI API returned no response body');
  }

  return parseSSEStream(response.body);
}

async function parseSSEStream(body: ReadableStream<Uint8Array>): Promise<TurnResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  const result: TurnResult = { tokens: [], toolCalls: [], done: false };
  let buffer = '';
  let currentToolCall: Partial<ToolCall> | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;

      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;

      try {
        const event: SSEEvent = JSON.parse(data);

        switch (event.type) {
          case 'token':
            if (event.content) result.tokens.push(event.content);
            break;

          case 'tool_call':
            currentToolCall = { tool: event.tool, args: event.args };
            break;

          case 'tool_result':
            if (currentToolCall) {
              result.toolCalls.push({
                tool: currentToolCall.tool!,
                args: currentToolCall.args ?? {},
                result: event.result,
              });
              currentToolCall = null;
            }
            break;

          case 'done':
            result.done = true;
            break;
        }
      } catch {
        // Skip malformed SSE events
      }
    }
  }

  return result;
}
