import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'

// Stage 0 hello world: a timed stream through the exact response machinery the
// real agent will use. If words appear one at a time in production, the entire
// pipeline is proven before any agent code exists.
export async function POST() {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const words = ['Pipeline', 'check:', 'build', '✓', 'deploy', '✓', 'streaming', '✓']
      for (const w of words) {
        writer.write({ type: 'text', text: w + ' ' })
        await new Promise((r) => setTimeout(r, 300)) // visible pacing — diagnostic, not product behavior
      }
    },
  })

  const response = createUIMessageStreamResponse({ stream })
  response.headers.set('X-Accel-Buffering', 'no')
  return response
}