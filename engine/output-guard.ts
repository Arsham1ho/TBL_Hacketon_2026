import { maskSecrets } from "./input-guard";
import type { Screen } from "./screens";

const banned = /(?:guaranteed safe|definitely safe|100% safe|täysin turvallinen|helt säker|ei voi olla huijaus|kan inte vara bedrägeri)/iu;

export function safeScreen(screen: Screen): boolean {
  const texts: string[] = [];
  const collect = (value: unknown): void => {
    if (typeof value === "string") texts.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect(screen);
  return texts.every(value => !banned.test(value) && maskSecrets(value).found.length === 0);
}
