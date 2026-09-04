'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useRef, useState } from 'react'

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
          {step.input?.query && <span className="text-zinc-500"> "{step.input.query}"</span>}
          {step.input?.url && <span className="text-zinc-500"> {step.input.url}</span>}
        </span>
        {outcome?.kind === 'search' && (
          <span className="ml-auto text-xs text-zinc-500">{outcome.count} results</span>
        )}
        {outcome?.kind === 'read' && (
          <span className="ml-auto text-xs text-zinc-500">{(outcome.chars / 1000).toFixed(1)}k chars</span>
        )}
        {outcome?.kind === 'error' && (
          <span className="ml-auto text-xs text-red-400">error</span>
        )}
        {outcome?.kind === 'search' && (
          <span className="text-zinc-600">{open ? '−' : '+'}</span>
        )}
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

export default function Home() {
  const { messages, sendMessage, status, stop, error } = useChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const canSend = status === 'ready' || status === 'error'

  function onSubmit(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || !canSend) return
    sendMessage({ text })
    setInput('')
  }

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col px-4">
      <header className="border-b border-zinc-800 py-4">
        <h1 className="text-lg font-semibold">Research Agent</h1>
        <p className="text-sm text-zinc-500">Ask anything — watch it search, read, and answer with sources.</p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {messages.length === 0 && (
          <div className="mt-8 space-y-2 text-sm text-zinc-500">
            <p>Try:</p>
            <p className="text-zinc-400">"What's the latest stable Node.js version?"</p>
            <p className="text-zinc-400">"Compare pgvector and Pinecone for a small RAG app"</p>
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

              {message.parts.map((part, i) =>
                part.type === 'text' && part.text.trim() ? (
                  <div key={i} className="rounded-2xl bg-zinc-900 px-4 py-2 text-zinc-200">
                    {part.text
                      .split('\n')
                      .filter((l) => l.trim())
                      .map((line, li) => (
                        <p key={li} className="mb-1 last:mb-0">{line}</p>
                      ))}
                  </div>
                ) : null
              )}
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