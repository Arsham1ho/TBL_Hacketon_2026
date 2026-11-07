import { Radio } from "lucide-react";
import type { Language } from "@/engine/types";

const copy = {
  en: { title: "Simulated pattern match", match: "Similar pattern in the demo feed", caution: "A resemblance is not proof of fraud." },
  fi: { title: "Simuloitu malliosuma", match: "Samankaltainen malli demoaineistossa", caution: "Samankaltaisuus ei todista huijausta." },
  sv: { title: "Simulerad mönsterträff", match: "Liknande mönster i demomaterialet", caution: "En likhet bevisar inte bedrägeri." },
} as const;

export function ScamRadarMatch({ language, radar }: { language: Language; radar: { title: string; clue: string } }) {
  const c = copy[language];
  return <aside className="rounded-xl border border-border bg-accent p-3" aria-label={c.title}>
    <p className="flex items-center gap-2 text-xs font-semibold"><Radio className="size-4" aria-hidden />{c.match}</p>
    <p className="mt-1 text-sm font-medium">{radar.title}</p>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{radar.clue} {c.caution}</p>
  </aside>;
}
