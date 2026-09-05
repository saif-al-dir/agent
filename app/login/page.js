'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Demo account — public by design. Cost abuse is bounded by the per-user
// rate limiter (10 runs/hour).
const DEMO_EMAIL = 'demo@example.com'
const DEMO_PASSWORD = 'Password123'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const router = useRouter()

  async function signIn(email, password) {
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (mode === 'login') {
      await signIn(email, password)
      return
    }
    setBusy(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setBusy(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-center text-xl font-semibold">Research Agent</h1>
      <p className="mb-6 text-center text-sm text-zinc-500">
        It searches, reads, and answers — with sources.
      </p>

      <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-zinc-800 p-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 outline-none focus:border-zinc-500"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 chars)"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-zinc-100 px-4 py-2 font-medium text-zinc-900 disabled:opacity-40"
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null) }}
          className="w-full text-xs text-zinc-500 hover:text-zinc-300"
        >
          {mode === 'login' ? 'No account? Sign up' : 'Have an account? Log in'}
        </button>

        <div className="flex items-center gap-2 pt-1 text-xs text-zinc-600">
          <span className="h-px flex-1 bg-zinc-800" />
          or
          <span className="h-px flex-1 bg-zinc-800" />
        </div>

        <button
          type="button"
          onClick={() => signIn(DEMO_EMAIL, DEMO_PASSWORD)}
          disabled={busy}
          className="w-full rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 disabled:opacity-40"
        >
          Just looking? Explore the demo account
        </button>

        {error && <p className="text-center text-xs text-red-400">{error}</p>}
      </form>
    </main>
  )
}