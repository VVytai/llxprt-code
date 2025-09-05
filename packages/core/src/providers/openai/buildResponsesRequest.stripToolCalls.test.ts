import { describe, it, expect } from 'vitest';
import { buildResponsesRequest } from './buildResponsesRequest.js';
import { IContent } from '../../services/history/IContent.js';
describe('buildResponsesRequest - tool_calls stripping', () => {
  it('should strip tool_calls from messages when building request', () => {
    const messages: IContent[] = [
      {
        speaker: 'human',
        blocks: [{ type: 'text', text: 'What is the weather?' }],
      },
      {
        speaker: 'ai',
        blocks: [
          {
            type: 'tool_call',
            id: 'call_123',
            name: 'get_weather',
            parameters: { location: 'San Francisco' },
          },
        ],
      },
      {
        speaker: 'tool',
        blocks: [
          {
            type: 'tool_response',
            callId: 'call_123',
            toolName: 'get_weather',
            result: 'Sunny, 72°F',
          },
        ],
      },
    ];

    const request = buildResponsesRequest({
      model: 'o3',
      messages,
      stream: true,
    });

    // Check that input messages don't have tool_calls
    expect(request.input).toBeDefined();
    expect(request.input?.length).toBe(4); // 2 regular messages + 1 function_call + 1 function_call_output

    // First message should be unchanged
    expect(request.input?.[0]).toEqual({
      role: 'user',
      content: 'What is the weather?',
    });

    // Second message should have tool_calls stripped
    expect(request.input?.[1]).toEqual({
      role: 'assistant',
    });
    expect(
      (request.input?.[1] as Record<string, unknown>).tool_calls,
    ).toBeUndefined();

    // Third entry should be the function_call
    expect(request.input?.[2]).toEqual({
      type: 'function_call',
      call_id: 'call_123',
      name: 'get_weather',
      arguments: '{"location":"San Francisco"}',
    });

    // Fourth entry should be the function_call_output
    expect(request.input?.[3]).toEqual({
      type: 'function_call_output',
      call_id: 'call_123',
      output: 'Sunny, 72°F',
    });
  });

  it('should handle messages without tool_calls', () => {
    const messages: IContent[] = [
      {
        speaker: 'human',
        blocks: [{ type: 'text', text: 'Hello' }],
      },
      {
        speaker: 'ai',
        blocks: [{ type: 'text', text: 'Hi there!' }],
      },
    ];

    const request = buildResponsesRequest({
      model: 'o3',
      messages,
    });

    expect(request.input).toEqual([
      {
        role: 'user',
        content: 'Hello',
      },
      {
        role: 'assistant',
        content: 'Hi there!',
      },
    ]);
  });

  it('should preserve usage data when stripping tool_calls', () => {
    const messages: IContent[] = [
      {
        speaker: 'ai',
        blocks: [
          { type: 'text', text: 'Let me check the weather' },
          {
            type: 'tool_call',
            id: 'call_456',
            name: 'get_weather',
            parameters: {},
          },
        ],
        metadata: {
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
        },
      },
    ];

    const request = buildResponsesRequest({
      model: 'o3',
      messages,
    });

    // Should strip tool_calls but keep usage
    expect(request.input?.[0]).toEqual({
      role: 'assistant',
      content: 'Let me check the weather',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    });
    expect(
      (request.input?.[0] as Record<string, unknown>).tool_calls,
    ).toBeUndefined();
  });
});
