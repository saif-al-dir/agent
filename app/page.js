'use client'

import { useChat } from '@ai-sdk/react'

export default function Home() {
  const { messages, sendMessage, status } = useChat()

  return (
    <main style={{ maxWidth: 600, margin: '0 auto' }}>
      <h1>Research Agent</h1>
      <p>Stage 0 — pipeline check. Words must appear one at a time:</p>

      {messages.map((m) =>
        m.parts?.map((part, i) =>
          part.type === 'text' ? <p key={i}>{part.text}</p> : null
        )
      )}

      {status === 'ready' ? (
        <button onClick={() => sendMessage({ text: 'go' })}>Start stream test</button>
      ) : (
        <p>streaming…</p>
      )}
    </main>
  )
}