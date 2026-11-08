import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Journey } from "../engine/handle-event";

// Serverless hosts such as Vercel run each request on whichever instance is free, so a session
// kept in one instance's memory is missing on the next request. The journey therefore also
// travels with the client as an encrypted token (AES-256-GCM). The server can restore it on
// any instance; the client can neither read nor change it. The session id is bound in as
// additional data, so a token only works for its own session.
//
// Needs SESSION_SECRET (at least 16 characters). Without it, sessions stay in memory only,
// which is fine for a single local server.

const MAX_TOKEN_CHARS = 2_000_000;
const secret = () => (process.env.SESSION_SECRET ?? "").trim();
const key = () => createHash("sha256").update(`safestep-session-v1:${secret()}`).digest();

export const sealingEnabled = () => secret().length >= 16;

export function sealJourney(id: string, journey: Journey, ttlMs: number): string | undefined {
  if (!sealingEnabled()) return undefined;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(id));
  const body = Buffer.concat([cipher.update(JSON.stringify({ exp: Date.now() + ttlMs, journey }), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unsealJourney(id: string, token: unknown): Journey | null {
  if (!sealingEnabled() || typeof token !== "string" || !token || token.length > MAX_TOKEN_CHARS) return null;
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(id));
    decipher.setAuthTag(raw.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8"));
    return typeof data?.exp === "number" && data.exp > Date.now() && data.journey ? (data.journey as Journey) : null;
  } catch {
    return null;
  }
}
