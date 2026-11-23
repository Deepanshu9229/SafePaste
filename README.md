# SafePaste

Mask personal data, including Indian IDs (Aadhaar, PAN, GSTIN, UPI), before you paste text into an AI tool, then restore the real values in the AI's reply.

Structured IDs are detected and masked in your browser, so they never leave your device.

> Work in progress. Week 1: browser-only detectors and the paste → mask → copy → restore flow.

## Stack

Next.js 16 (App Router, static export) · TypeScript · Redux Toolkit · Tailwind CSS v4 · shadcn/ui

## Run locally

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # static site in out/
```
