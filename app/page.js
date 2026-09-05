'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useRef, useState } from 'react'

const STORAGE_KEY = 'agent-chat-v1'

function loadStoredMessages() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const TOOL_META = {
  webSearch: { icon: '🔍', label: 'Searching the web' },
  readPage: { icon: '📖', label: 'Reading page' },
}

function StepCard({ step }) {
  const [open, setOpen] = useState(false)
  const meta = TOOL_META[step.tool] ?? { icon: '⚙️', label: step.tool }
  const { outcome } = step

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm">
      <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(!open)}>
        <span>{meta.icon}</span>
        <span className="text-zinc-300">
          {meta.label}
          {step.input?.query && <span className="text-zinc-500"> &quot;{step.input.query}&quot;</span>}
          {step.input?.url && <span className="text-zinc-500"> {step.input.url}</span>}
        </span>
        {outcome?.kind === 'search' && (
          <span className="ml-auto text-xs text-zinc-500">{outcome.count} results</span>
        )}
        {outcome?.kind === 'read' && (
          <span className="ml-auto text-xs text-zinc-500">
            {(outcome.chars / 1000).toFixed(1)}k chars
          </span>
        )}
        {outcome?.kind === 'error' && <span className="ml-auto text-xs text-red-400">error</span>}
        {outcome?.kind === 'search' && <span className="text-zinc-600">{open ? '−' : '+'}</span>}
      </button>

      {outcome?.kind === 'error' && (
        <p className="mt-1 text-xs text-red-400">{outcome.message}</p>
      )}

      {open && outcome?.kind === 'search' && (
        <ul className="mt-2 space-y-1 border-t border-zinc-800 pt-2">
          {outcome.results.map((r, i) => (
            <li key={i} className="text-xs">
              <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
                {r.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// [1] [2] markers in the answer text → styled chips
function Citations({ text }) {
  return text.split(/(\[\d{1,2}\])/).map((seg, i) => {
    const m = seg.match(/^\[(\d{1,2})\]$/)
    return m ? (
      <span key={i} className="mx-0.5 rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-medium text-sky-300">
        {seg}
      </span>
    ) : (
      <span key={i}>{seg}</span>
    )
  })
}

const isSourceHeader = (l) => /^\s*\**\s*sources?\s*:?\s*\**\s*$/i.test(l)
const isSourceLine = (l) => /^\s*[-*]?\s*\[\d+\]/.test(l)

// One "Sources:" entry line → clickable link line
function SourceLine({ line }) {
  const m = line.match(/^\s*[-*]?\s*\[(\d+)\]\s*(.*)$/)
  if (!m) return <p className="text-sm">{line}</p>
  const rest = m[2]
  const urlMatch = rest.match(/(https?:\/\/[^\s]+)/)
  const title = urlMatch
    ? rest.slice(0, urlMatch.index).replace(/[—–-]\s*$/, '').trim()
    : rest
  return (
    <p className="flex items-baseline gap-2 text-sm">
      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-medium text-sky-300">[{m[1]}]</span>
      {urlMatch ? (
        <a href={urlMatch[1]} target="_blank" rel="noopener noreferrer" className="truncate text-sky-400 hover:underline">
          {title || urlMatch[1]}
        </a>
      ) : (
        <span>{title}</span>
      )}
    </p>
  )
}

// Answer body + trailing sources collected into a boxed section.
// Progressive: while streaming, the box builds line by line.
function Answer({ text }) {
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  let split = lines.length
  while (split > 0 && (isSourceLine(lines[split - 1]) || isSourceHeader(lines[split - 1]))) split--
  const body = lines.slice(0, split)
  const sources = lines.slice(split).filter(isSourceLine)

  return (
    <div className="rounded-2xl bg-zinc-900 px-4 py-2 text-zinc-200">
      {body.map((line, i) => (
        <p key={i} className="mb-1 last:mb-0">
          <Citations text={line} />
        </p>
      ))}
      {sources.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-zinc-800 pt-2">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Sources</p>
          {sources.map((line, i) => (
            <SourceLine key={i} line={line} />
          ))}
        </div>
      )}
    </div>
  )
}

function UsageLine({ usage }) {
  if (!usage) return null
  const tokens = ((Number(usage.inputTokens) + Number(usage.outputTokens)) / 1000).toFixed(1)
  const parts = [
    `${usage.steps} steps`,
    `${usage.searches} searches`,
    usage.reads ? `${usage.reads} reads` : null,
    `${tokens}k tokens`,
    `≈$${usage.costUsd}`,
    `${(usage.durationMs / 1000).toFixed(1)}s`,
  ].filter(Boolean)
  return <p className="text-xs text-zinc-500">{parts.join(' · ')}</p>
}

export default function Home() {
  const [initialMessages] = useState(loadStoredMessages)
  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    messages: initialMessages,
  })
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Persist only when idle — writing per streamed token would thrash localStorage
  useEffect(() => {
    if (status !== 'ready') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {}
  }, [messages, status])

  const canSend = status === 'ready' || status === 'error'

  function onSubmit(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || !canSend) return
    sendMessage({ text })
    setInput('')
  }

  function newResearch() {
    setMessages([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col px-4">
      <header className="flex items-center justify-between border-b border-zinc-800 py-4">
        <div>
          <h1 className="text-lg font-semibold">Research Agent</h1>
          <p className="text-sm text-zinc-500">
            Ask anything — watch it search, read, and answer with sources.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={newResearch}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
          >
            New research
          </button>
        )}
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {messages.length === 0 && (
          <div className="mt-8 space-y-2 text-sm text-zinc-500">
            <p>Try:</p>
            <p className="text-zinc-400">&quot;What&apos;s the latest stable Node.js version?&quot;</p>
            <p className="text-zinc-400">&quot;Compare pgvector and Pinecone for a small RAG app&quot;</p>
          </div>
        )}

        {messages.map((message) => {
          if (message.role === 'user') {
            return (
              <div key={message.id} className="ml-auto max-w-[80%] rounded-2xl bg-zinc-800 px-4 py-2">
                {message.parts.map((part, i) =>
                  part.type === 'text' ? <p key={i}>{part.text}</p> : null
                )}
              </div>
            )
          }

          const steps = message.parts.filter((p) => p.type === 'data-steps').map((p) => p.data)
          const usage = message.parts.find((p) => p.type === 'data-usage')?.data
          const answerText = message.parts
            .filter((p) => p.type === 'text')
            .map((p) => p.text)
            .join('')

          return (
            <div key={message.id} className="mr-auto max-w-[90%] space-y-2">
              {steps.length > 0 && (
                <div className="space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-900/30 p-2">
                  <p className="px-1 pb-1 text-xs uppercase tracking-wide text-zinc-500">
                    Research steps
                  </p>
                  {steps.map((s, i) => (
                    <StepCard key={i} step={s} />
                  ))}
                </div>
              )}

              {answerText.trim() && <Answer text={answerText} />}
              <UsageLine usage={usage} />
            </div>
          )
        })}

        {status === 'submitted' && (
          <div className="mr-auto rounded-2xl bg-zinc-900 px-4 py-2 text-sm text-zinc-500">
            planning research…
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-950 p-3 text-sm text-red-300">
            {error.message || 'Something went wrong'}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-zinc-800 py-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={canSend ? 'Ask a research question…' : 'Agent is working…'}
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 outline-none focus:border-zinc-500"
          autoFocus
        />
        {canSend ? (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-xl bg-zinc-100 px-4 py-2 font-medium text-zinc-900 disabled:opacity-40"
          >
            Ask
          </button>
        ) : (
          <button type="button" onClick={stop} className="rounded-xl border border-zinc-700 px-4 py-2 text-zinc-300">
            Stop
          </button>
        )}
      </form>
    </main>
  )
}