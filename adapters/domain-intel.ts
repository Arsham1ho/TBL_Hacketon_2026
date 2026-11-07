import { promises as dns } from "node:dns";
import type { DomainIntel } from "../engine/link-check";

// Public facts about a domain, looked up without ever opening the link:
// - when it was registered, from RDAP (the public successor to WHOIS), asked of the domain's
//   own registry through IANA's official bootstrap list;
// - whether the name exists at all, from DNS.
// Only the bare domain name leaves the server, never the path, query or the user's message.

const DOMAIN = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const cache = new Map<string, { at: number; value: DomainIntel }>();
const TTL_MS = 6 * 60 * 60 * 1000;

const HEADERS = { accept: "application/rdap+json, application/json", "user-agent": "SafeStep/0.1 (domain age check)" };

// IANA's official list of which registry answers RDAP for each top-level domain, fetched once.
let bootstrap: Promise<Map<string, string>> | null = null;
function registryServers(timeoutMs: number): Promise<Map<string, string>> {
  bootstrap ??= fetch("https://data.iana.org/rdap/dns.json", { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) })
    .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
    .then((data: { services?: [string[], string[]][] }) => {
      const servers = new Map<string, string>();
      for (const [tlds, urls] of data.services ?? []) {
        const url = urls.find((item) => item.startsWith("https://")) ?? urls[0];
        if (url) for (const tld of tlds) servers.set(tld.toLowerCase(), url.endsWith("/") ? url : `${url}/`);
      }
      return servers;
    })
    .catch((error) => {
      bootstrap = null;
      throw error;
    });
  return bootstrap;
}

// Asks the domain's own registry when it was registered. 404 means nobody has registered it.
async function registeredAt(domain: string, timeoutMs: number): Promise<string | null | "missing"> {
  try {
    const tld = domain.split(".").at(-1)!;
    const base = (await registryServers(timeoutMs).catch(() => null))?.get(tld) ?? "https://rdap.org/";
    const response = await fetch(`${base}domain/${encodeURIComponent(domain)}`, { headers: HEADERS, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    if (response.status === 404) return "missing";
    if (!response.ok) return null;
    const data = (await response.json()) as { events?: { eventAction?: string; eventDate?: string }[] };
    const event = data.events?.find((item) => item.eventAction === "registration");
    return event?.eventDate && !Number.isNaN(Date.parse(event.eventDate)) ? event.eventDate : null;
  } catch {
    return null;
  }
}

async function resolves(domain: string, timeoutMs: number): Promise<boolean | null> {
  const lookup = Promise.any([dns.resolve4(domain), dns.resolve6(domain)])
    .then(() => true)
    .catch((error: AggregateError) => (error.errors?.some((item: { code?: string }) => item.code === "ENOTFOUND" || item.code === "ENODATA") ? false : null));
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([lookup, timeout]);
}

// Never throws. Anything that can't be looked up in time comes back as null, meaning unknown.
export async function lookupDomain(domain: string, timeoutMs = 3000): Promise<DomainIntel> {
  const name = domain.toLowerCase();
  if (!DOMAIN.test(name)) return { registeredAt: null, resolves: null, registered: null };
  const cached = cache.get(name);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  const [registration, exists] = await Promise.all([registeredAt(name, timeoutMs), resolves(name, timeoutMs)]);
  const value: DomainIntel = {
    registeredAt: registration === "missing" ? null : registration,
    registered: registration === "missing" ? false : registration ? true : null,
    resolves: exists,
  };
  // Only answers are kept. A failed lookup is tried again next time.
  if (value.registered !== null || value.resolves !== null) cache.set(name, { at: Date.now(), value });
  return value;
}
