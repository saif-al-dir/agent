import { streamText, stepCountIs, createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { openai } from '@ai-sdk/openai'
import { webSearch, readPage } from '../../../lib/agent-tools'
import { AGENT_SYSTEM } from '../../../lib/agent-prompt'

// Approximate cost model (documented in README):
// gpt-4o-mini $0.15/1M input + $0.60/1M output tokens · Tavily ~$0.005 per call
const LLM_IN = 0.15
const LLM_OUT = 0.6
const TOOL_CALL = 0.005

export async function POST(req) {
  const startedAt = Date.now()
  const { messages } = await req.json()

  const modelMessages = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role,
      content: Array.isArray(m.parts)
        ? m.parts.filter((p) => p.type === 'text').map((p) => p.text).join('')
        : m.content ?? '',
    }))
    .filter((m) => m.content.length > 0)

  let searches = 0
  let reads = 0

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: openai('gpt-4o-mini'),
        system: AGENT_SYSTEM,
        messages: modelMessages,
        tools: { webSearch, readPage },
        stopWhen: stepCountIs(8),

        onStepFinish: (step) => {
          for (const call of step.toolCalls ?? []) {
            if (call.toolName === 'webSearch') searches++
            if (call.toolName === 'readPage') reads++
            const output = (step.toolResults ?? []).find(
              (r) => r.toolCallId === call.toolCallId
            )?.output
            writer.write({
              type: 'data-steps',
              data: { tool: call.toolName, input: call.input, outcome: summarizeOutcome(output) },
            })
          }
        },
      })

      writer.merge(result.toUIMessageStream())

      // Per-run stats, shipped AFTER the answer completes (ordering: steps →
      // answer → usage). Best-effort: an aborted run just skips the stats.
      try {
        const [usage, steps] = await Promise.all([result.usage, result.steps])
        const inputTokens = usage?.inputTokens ?? 0
        const outputTokens = usage?.outputTokens ?? 0
        const cost =
          (inputTokens * LLM_IN + outputTokens * LLM_OUT) / 1_000_000 +
          (searches + reads) * TOOL_CALL
        writer.write({
          type: 'data-usage',
          data: {
            steps: steps?.length ?? 0,
            searches,
            reads,
            inputTokens,
            outputTokens,
            costUsd: Number(cost.toFixed(4)),
            durationMs: Date.now() - startedAt,
          },
        })
      } catch {}
    },
    onError: (error) => {
      console.error('[agent] stream error:', error)
      return 'Something went wrong — see server logs.'
    },
  })

  const response = createUIMessageStreamResponse({ stream })
  response.headers.set('X-Accel-Buffering', 'no')
  return response
}

function summarizeOutcome(output) {
  if (!output) return { kind: 'unknown' }
  if (output.error) return { kind: 'error', message: output.error }
  if (output.results) {
    return {
      kind: 'search',
      count: output.results.length,
      results: output.results.map((r) => ({ title: r.title, url: r.url })),
    }
  }
  if (output.content) return { kind: 'read', chars: output.content.length }
  return { kind: 'unknown' }
}