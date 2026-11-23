# SafePaste

Mask personal data, including Indian IDs (Aadhaar, PAN, GSTIN, UPI), before you paste text into an AI tool, then restore the real values in the AI's reply.

Structured IDs are detected and masked in your browser, so they never leave your device.

Names and addresses can then be found by an optional AI scan, which runs on SafePaste's own server with a self-hosted model. Only the already-masked text is sent to it.

> Work in progress. Done: browser detectors, mask → review → copy → restore, AI scan API. Next: deployment, hidden-clue check, Private Ask.

## Stack

- **Web app:** Next.js 16 (App Router, static export) · TypeScript · Redux Toolkit · Tailwind CSS v4 · shadcn/ui
- **API** (`server/`): Express 5 · TypeScript · Server-Sent Events · Ollama (llama3.2:3b) · Cloudflare Turnstile

## Run locally

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests (Vitest)
npm run build    # static site in out/
```

## Detectors

Structured IDs are found in the browser by regex + checksum, in this order (earlier wins on overlap):

| Type | Rule |
|---|---|
| GSTIN | State code + PAN + entity + `Z` + mod-36 check character |
| Aadhaar | 12 digits, first 2–9, Verhoeff check digit |
| Card | 13–19 digits, Luhn check |
| PAN | `AAAAA9999A`, 4th letter one of `PCHFATBLJG` |
| UPI | `name@handle` with a known handle (okaxis, ybl, paytm, …) |
| Email | Standard address format |
| Phone | Optional `+91`/`0`, then 10 digits starting 6–9 |

All test data is synthetic or public test numbers.

## API (`server/`)

The API is a separate package. It needs [Ollama](https://ollama.com) running on the same machine.

```bash
cd server
npm install
cp .env.example .env   # then edit it
npm run dev            # http://127.0.0.1:8080
npm test               # runs against a fake Ollama, no model needed
```

To use it from the web app, copy `.env.example` in the repo root to `.env.local` and restart `npm run dev`.

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | `{ status, model, lastTokensPerSec, queueLength }` |
| `POST /api/scan` | Body `{ text, turnstileToken }`. Streams `queued`, `entity`, `stats`, `done` or `error` events (SSE). |

Protections: Cloudflare Turnstile token per request, CORS allowlist, 10 requests per minute per IP, 1,000-character input limit, a queue (1 running, 2 waiting), a 45-second timeout. An entity from the model is kept only if its text appears word for word in the input. Request text is never logged or stored.
