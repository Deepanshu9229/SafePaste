# SafePaste — project brief

@AGENTS.md

## What it is
SafePaste masks personal data in pasted text, including Indian IDs, so people can use AI on it
safely (ChatGPT, or SafePaste's own self-hosted model), then restores the real values in the
AI's answer. Portfolio project showing full-stack + AI + automation; possible startup later.
Full HLD (Claude Docs): https://claude.ai/artifact/Xkh43SiReB8AACMB9UYsxA

## User flow
1. Paste → the browser instantly masks structured IDs (these never leave the browser).
2. AI scan → the self-hosted model finds names and addresses; highlights stream in one by one.
3. Review → the user removes highlights or selects extra text to mask.
4. Copy masked text, e.g. "Hi [PERSON_1], PAN [PAN_1]". The tag map {tag: original} stays in the browser.
5. Restore → paste an AI reply; tags become real values again.
Extra AI features:
- Hidden-clue check: flags indirect identifiers ("the only cardiologist at the Nashik branch").
- Private Ask: own model summarizes/drafts from masked text, streamed, with live un-masking,
  a "Show what the server received" toggle, and a Stop button.

## Architecture (decided)
- Frontend: Next.js (App Router, output: 'export'), TypeScript, Redux Toolkit. REST calls via
  axios + createAsyncThunk (not RTK Query). AI calls via SSE using @microsoft/fetch-event-source
  (POST). Streams never auto-retry: throw in onerror, set openWhenHidden: true.
  Detectors run in a Web Worker. Hosted on Vercel as static files only; Vercel never sees pasted text.
- UI: Tailwind CSS + shadcn/ui (chosen for job-market relevance over Mantine/MUI).
- Backend on the Oracle VM: Caddy (HTTPS via a DuckDNS subdomain, forwards /api/* to
  127.0.0.1:8080, 16 KB body cap) → Node REST API (Express)
  → Ollama on 127.0.0.1:11434.
- API protection, no API key (a browser can't keep secrets): Cloudflare Turnstile token per
  request, CORS allowlist, per-IP limit of 10 AI requests/min in memory (IP from
  X-Forwarded-For, trusted only from Caddy), 1,000-character input cap, queue (1 running,
  2 waiting, otherwise 503).
- If the API runs in Docker, use network_mode: host so it can reach Ollama on 127.0.0.1.

## Server (Oracle Always Free)
VM.Standard.A1.Flex: 2 OCPU (Arm), 12 GB RAM, Ubuntu.
Already running: Ollama (chat works), Docker, n8n + PostgreSQL in Docker (network n8n-network).
Not set up yet: n8n workflows, cron jobs.
n8n (done 2026-11-24): started with `docker run`, published on 127.0.0.1:5678 only, settings in
~/n8n.env, data in ~/.n8n, `--add-host host.docker.internal:172.18.0.1` so it can reach Ollama.
Open the editor through an SSH tunnel (`ssh -L 5678:127.0.0.1:5678 ...`) at http://localhost:5678.
Ollama listens on 0.0.0.0:11434 (needed by the n8n container); not reachable from the internet
(blocked by the Oracle security list).
SECURITY TODO: remove the leftover iptables ACCEPT rules for 5678 and 11434 (limit 11434 to the Docker
network) and the matching Oracle security-list rules. Pending: 21 apt updates + a restart.
CPU is the constraint. Model (decided 2026-11-24): llama3.2:3b. Measured on this VM with 2 threads:
- llama3.1:8b: reads 9.9 tok/s, writes 3.2 tok/s. A full-size scan (301 prompt + 200 output tokens)
  took 92 s, over the 45 s limit. Still installed, not used.
- llama3.2:3b: reads 23.6 tok/s, writes 7.0 tok/s; cold load 14 s. The same scan is estimated at ~42 s,
  so the worst case is close to the limit: keep prompts and output short, and keep the model loaded.
Measure with `ollama run <model> --verbose`.
Optional: resize the VM to 4 OCPU / 24 GB if that free quota is unused (would give more headroom).

## Detectors (browser, in this order)
GSTIN (state code + mod-36 check character) → Aadhaar (12 digits, first digit 2–9, Verhoeff)
→ card (13–19 digits, Luhn) → PAN (AAAAA9999A; 4th letter one of PCHFATBLJG)
→ UPI (known handles e.g. okaxis, oksbi, ybl, paytm) → email → phone (+91 or 0, then 10 digits starting 6–9).
AI detects PERSON and ADDRESS. Grounding check: keep an entity only if it appears verbatim; use a stop list.
Tags: [TYPE_n], one per distinct value. Restore with a tolerant matcher ([PERSON_1], PERSON_1,
[Person 1], {PERSON_1}). In streamed text, hold back anything after an unclosed "[" until "]" arrives.

## API (REST + SSE)
GET  /api/health → { status, model, lastTokensPerSec, queueLength }
POST /api/scan       { text, turnstileToken }                     → SSE: queued, entity {type,text}, stats, done, error
POST /api/clue-check { text, turnstileToken }                     → SSE: queued, clue {text,reason}, stats, done, error
POST /api/ask        { text, preset, question?, turnstileToken }  → SSE: queued, token {text}, stats, done, error
Errors before a stream starts: 400, 403, 429 (Retry-After), 503. A 45 s timeout arrives as an error event.
Ollama /api/chat: stream true, temperature 0, num_thread 2, num_predict 120 (ask) / 200 (scan, clue),
keep_alive "30m". Scan and clue: one JSON object per line (no `format` option); validate each line.
Abort the Ollama request when the client disconnects. Caddy: flush_interval -1.

## Data + n8n
usage_logs (PostgreSQL): created_at, endpoint, status, model, input_chars, entity_counts JSONB,
output_tokens, tokens_per_sec, total_ms, visitor_hash (hash of IP + date + secret).
NEVER store pasted text or raw IPs.
n8n: daily digest (SQL → local LLM summary → Telegram), health check every 5 min,
nightly evaluation on the labelled test set. Plus a keep-alive cron job.

## Plan
W0 server prep (close ports, pick model) · W1 rules-only app live on Vercel · W2 API + AI scan
· W3 clue check + Private Ask · W4 usage_logs + n8n + cron · W5 test set (50 synthetic samples,
publish precision/recall), README, demo GIF.
Rules: ship every week; never store pasted text; keep n8n private; synthetic test data only
(never real Aadhaar/PAN/card numbers).

## Open questions
Private Ask: presets only or also free text · tag style ([PERSON_1] vs realistic fake names;
the app currently uses [TYPE_n]).
Decided: Express · DuckDNS · model llama3.2:3b (8B was too slow, see Server).

## About me / how to work with me
Deepanshu, frontend engineer (React, TypeScript, Redux, Mantine; built SSE alerts with
fetch-event-source at work). I prefer minimal, explicit code with consistent patterns,
verified facts over guesses (say "I believe" when unsure), and concise answers.

## Start now
1. Save this brief as CLAUDE.md in the repo root.
2. Week 1: git init; scaffold Next.js (static export) + TypeScript + Redux Toolkit; implement the
   browser detectors with checksum validators and unit tests; build
   paste → highlight → toggle → masked output → copy → restore.
