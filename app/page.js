'use client'

import { useChat } from '@ai-sdk/react'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'agent-chat-v1'

// ... loadStoredMessages, TOOL_META, StepCard, Citations, SourceLine, Answer,
//     UsageLine — unchanged from Stage 3 ...

export default function Home() {
  const { messages, sendMessage, status, stop, error, setMessages } = useChat()
  const [input, setInput] = useState('')
  const [email, setEmail] = useState(null)
  const [quota, setQuota] = useState(null)
  const bottomRef = useRef(null)
  const router = useRouter()

  useEffect(() => {
    const stored = loadStoredMessages()
    if (stored.length > 0) setMessages(stored)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setEmail(data?.user?.email ?? null))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (status !== 'ready' || messages.length === 0) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    } catch {}
  }, [messages, status])

  // Quota updates from the latest data-quota part
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    const part = lastAssistant?.parts.find((p) => p.type === 'data-quota')
    if (part) setQuota(part.data)
  }, [messages])

  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

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
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={newResearch}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500"
            >
              New research
            </button>
          )}
          {email && (
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="hidden text-zinc-500 sm:inline">{email}</span>
              <button
                onClick={logout}
                className="rounded-lg border border-zinc-700 px-2 py-1 hover:border-zinc-500"
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* messages area — unchanged from Stage 3 */}

      {/* NEW: quota line just above the form */}
      <div className="py-1 text-xs text-zinc-500">
        {quota && <span>{quota.remaining} questions left · resets in {quota.resetInMin} min</span>}
      </div>

      {/* form — unchanged from Stage 3 */}
    </main>
  )
}