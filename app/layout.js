import './globals.css'

export const metadata = {
    title: 'Research Agent',
    description: 'It searches, reads, and answers — with sources.',
    icons: {
      icon: '/favicon.svg',
    },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  )
}