import 'dotenv/config'
import { generateText, stepCountIs } from 'ai'
import { openai } from '@ai-sdk/openai'
import { webSearch, readPage } from '../lib/agent-tools.js'

// In Stage 2 this prompt moves to the API route, unchanged
const SYSTEM = `You are a research agent with two tools: webSearch and readPage.

Strategy:
1. Start with 1-2 focused searches. Refine the query if results are weak.
2. Only readPage when a result is clearly relevant and its snippet is insufficient.
3. When you have enough evidence, stop and write the final answer.

Final answer format:
- Concise, well-structured answer to the question
- Inline citations as [1], [2] referring to numbered sources
- A "Sources:" list at the end, one line per source: [n] title — url
- If research doesn't produce a confident answer, say so explicitly. Never invent facts or URLs.

Efficiency: tool calls cost money — aim for at most 4 total. Precise queries beat brute force.`

const question = process.argv.slice(2).join(' ')
if (!question) {
  console.error('Usage: npm run agent -- "your question here"')
  process.exit(1)
}

console.log(`\n❓ ${question}\n`)

const result = await generateText({
  model: openai('gpt-4o-mini'),
  system: SYSTEM,
  prompt: question,
  tools: { webSearch, readPage },
  stopWhen: stepCountIs(8), // circuit breaker — the "stop condition" of the agent
  onStepFinish: (step) => {
    // Escape hatch: if any field below is undefined (version drift), dump the raw step
    if (process.env.DEBUG_STEPS) {
      console.log('DEBUG:', JSON.stringify(step, null, 2).slice(0, 2000))
    }
    for (const call of step.toolCalls ?? []) {
      if (call.toolName === 'webSearch') console.log(`🔍 searching: "${call.input?.query}"`)
      if (call.toolName === 'readPage') console.log(`📖 reading: ${call.input?.url}`)
    }
    for (const r of step.toolResults ?? []) {
      if (r.output?.error) console.log(`   ⚠️  ${r.output.error}`)
      if (r.output?.results) console.log(`   → ${r.output.results.length} results`)
      if (r.output?.content) console.log(`   → ${(r.output.content.length / 1000).toFixed(1)}k chars read`)
    }
  },
})

console.log('\n📝 FINAL ANSWER\n')
console.log(result.text)

const usage = result.usage ?? {}
console.log('\n' + '-'.repeat(50))
console.log(
  `steps: ${result.steps?.length ?? '?'} · ` +
  `in: ${usage.inputTokens ?? usage.promptTokens ?? '?'} · ` +
  `out: ${usage.outputTokens ?? usage.completionTokens ?? '?'} tokens`
)