import { streamText, stepCountIs, createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import { openai } from '@ai-sdk/openai'
import { webSearch, readPage } from '../../../lib/agent-tools.js'
import { AGENT_SYSTEM } from '../../../lib/agent-prompt.js'

export async function POST(req) {
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

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // streamText starts lazily when consumed — creating it HERE guarantees
      // onStepFinish always has the writer available (no lost early steps)
      const result = streamText({
        model: openai('gpt-4o-mini'),
        system: AGENT_SYSTEM,
        messages: modelMessages,
        tools: { webSearch, readPage },
        stopWhen: stepCountIs(8), // circuit breaker

        // Every completed step ships to the browser immediately as a data part
        onStepFinish: (step) => {
          const calls = step.toolCalls ?? []
          if (!calls.length) return // final text step — streams via the merged stream anyway
          for (const call of calls) {
            const result = (step.toolResults ?? []).find(
              (r) => r.toolCallId === call.toolCallId
            )?.output
            writer.write({
              type: 'data-steps',
              data: {
                tool: call.toolName,
                input: call.input,
                outcome: summarizeOutcome(result),
              },
            })
          }
        },
      })

      writer.merge(result.toUIMessageStream())
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