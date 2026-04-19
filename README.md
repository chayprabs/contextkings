# ContextKings

Prompt-to-workflow CrustData playground built with Next.js 16, the Vercel AI SDK, json-render, and PGlite.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and add your keys.

3. Start the app:

```bash
npm run dev
```
Then use the in-app "Run live demo" action to test the product with real public company domains from the web.

## Environment Variables

- `OPENAI_API_KEY`
- `OPENAI_MODEL` optional, defaults to `gpt-5.4`
- `OPENAI_REASONING_EFFORT` optional, defaults to `high`
- `CRUSTDATA_API_KEY`
- `CRUSTDATA_API_VERSION` optional, defaults to `2025-11-01`
- `CRUSTDATA_ENABLE_WEB` optional, defaults to `true`
