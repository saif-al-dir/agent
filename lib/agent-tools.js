import { tool } from 'ai'
import { z } from 'zod'

// Tools return { error } instead of throwing on purpose: a thrown error aborts
// the whole run, while an error *result* lets the model adapt (retry with a
// different query/URL). Agents fail gracefully or they fail constantly.

export const webSearch = tool({
  description:
    'Search the web. Returns up to 5 results with title, url, and a content snippet. Use for facts, news, versions, comparisons.',
  inputSchema: z.object({
    query: z.string().min(1).describe('Focused search query, e.g. "Next.js 16 release date"'),
  }),
  execute: async ({ query }) => {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
        },
        body: JSON.stringify({ query, max_results: 5, search_depth: 'basic' }),
      })
      if (!res.ok) {
        return { error: `Tavily search failed (${res.status}) — check TAVILY_API_KEY or quota` }
      }
      const data = await res.json()
      return {
        results: (data.results ?? []).slice(0, 5).map((r) => ({
          title: r.title,
          url: r.url,
          content: String(r.content ?? '').slice(0, 600),
        })),
      }
    } catch (err) {
      return { error: `Search request failed: ${err.message}` }
    }
  },
})

export const readPage = tool({
  description:
    'Read the main text of a web page. Use when a search result is clearly relevant but its snippet is too short. Content is truncated.',
  inputSchema: z.object({
    url: z.string().url().describe('The exact URL from a previous search result'),
  }),
  execute: async ({ url }) => {
    try {
      const res = await fetch('https://api.tavily.com/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
        },
        body: JSON.stringify({ urls: [url] }),
      })
      if (!res.ok) {
        return { error: `Read failed (${res.status})` }
      }
      const data = await res.json()
      const raw = data.results?.[0]?.raw_content
      if (!raw) return { error: 'No extractable text at this URL' }
      return { url, content: raw.slice(0, 5000) } // hard cap — context = cost
    } catch (err) {
      return { error: `Read request failed: ${err.message}` }
    }
  },
})