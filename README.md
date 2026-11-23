# SafePaste

Mask personal data, including Indian IDs (Aadhaar, PAN, GSTIN, UPI), before you paste text into an AI tool, then restore the real values in the AI's reply.

Structured IDs are detected and masked in your browser, so they never leave your device.

> Work in progress. Week 1: browser-only detectors and the paste → mask → copy → restore flow.

## Stack

Next.js 16 (App Router, static export) · TypeScript · Redux Toolkit · Tailwind CSS v4 · shadcn/ui

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
