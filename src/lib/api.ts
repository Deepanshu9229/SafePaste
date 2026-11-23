/** Base URL of the SafePaste API, e.g. "https://example.duckdns.org". Empty turns the AI features off. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** Cloudflare Turnstile site key (public). */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** Without both values the app works in rules-only mode. */
export const IS_AI_ENABLED = API_URL !== "" && TURNSTILE_SITE_KEY !== "";

/** Longest text the API accepts. Keep in sync with maxTextLength in server/src/config.ts. */
export const MAX_AI_TEXT_LENGTH = 1000;
