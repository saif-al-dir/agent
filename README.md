## Research Agent — an AI agent with visible reasoning

##### Live demo: https://agent.saif1.usermd.net — click "Explore the demo account"

##### Source: https://github.com/saif-al-dir/agent

Ask a research question and watch the agent work in real time: it searches theweb, reads pages, and writes a cited answer — with every step visible as ithappens, then costed.

### Product features
* Auth + rate limiting — Supabase Auth; the agent endpoint is expensive(multi-step LLM + web search), so access is gated and capped at 10 questionsper user per hour before any tokens are spent
* One-click demo account — public by design; abuse is bounded by the ratelimiter
* Persistent sessions — conversations survive reloads (localStorage,hydration-safe restore)
* Cited answers — [1] chips inline, expandable Sources box with clickable links

### Stack
* App - Next.js 16 (App Router, standalone output)
* Agent - Vercel AI SDK v5 — streamText, tools, stopWhen
* LLM - OpenAI gpt-4o-mini
* Web search - Tavily API (search + page extraction)
* Auth - Supabase Auth (separate project from my RAG app — separate user bases)
* CI/CD -	Actions → build → rsync over SSH → restart

### Run locally
git clone https://github.com/saif-al-dir/agent && cd agent => npm install => cp .env.example .env   # fill in OPENAI_API_KEY, TAVILY_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY => npm run dev
CLI version of the agent (same tools, same prompt, terminal output):

npm run agent -- "What is the latest stable Node.js version?"