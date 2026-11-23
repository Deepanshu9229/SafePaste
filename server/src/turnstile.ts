/** Returns true if the Turnstile token is valid. Throws if Cloudflare can't be reached. */
export type VerifyTurnstile = (token: string, ip: string | undefined) => Promise<boolean>;

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Checks tokens with Cloudflare. A browser can't keep an API key secret, so this is the bot check. */
export function createTurnstileVerifier(secret: string): VerifyTurnstile {
  return async (token, ip) => {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);

    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`Turnstile responded with ${response.status}`);

    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  };
}
