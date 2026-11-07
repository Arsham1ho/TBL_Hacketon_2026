import { maskSecrets } from "./input-guard";
import { evidenceForm } from "./link-check";
import type { Screen } from "./screens";
import { linkContextCopy } from "./link-context";
import type { Language } from "./types";
import approved from "../content/approved-text.json";
import { questionText } from "./composer";
import { approvedContextualQuestion } from "./contextual-question";
import { isApprovedIncidentCategory } from "./incident-category";
import questions from "../content/questions.json";
import reasons from "../content/reasons.json";
import steps from "../content/steps.json";

const banned = /(?:guaranteed safe|definitely safe|100% safe|täysin turvallinen|helt säker|ei voi olla huijaus|kan inte vara bedrägeri)/iu;

export function safeScreen(screen: Screen, language?: Language): boolean {
  const texts: string[] = [];
  const collect = (value: unknown): void => {
    if (typeof value === "string") texts.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect(screen);
  if (!texts.every(value => !banned.test(value) && maskSecrets(value).found.length === 0)) return false;
  if (!language) return true;
  const statusLabels = Object.values(approved.statusLabels).map(entry => entry[language]);
  const stepLines = Object.values(steps).map(entry => entry[language]);
  const conditions = Object.values(questions).flatMap(entry => [entry[language].ifRisky, entry[language].ifSafe]);
  const branchesAreApproved = (branches: { condition: string; steps: string[] }[]) =>
    branches.every(branch => conditions.includes(branch.condition) && branch.steps.every(step => stepLines.includes(step)));
  if (screen.type === "stop") return Object.values(approved.stop).some(entry => entry[language].message === screen.message && screen.actions[0] === entry[language].action);
  if (screen.type === "end" && approved.offTopic[language].none === screen.message) return true;
  if (screen.type === "fallback") return Object.values(approved.fallback).some(entry => entry[language].message === screen.message && JSON.stringify(entry[language].actions) === JSON.stringify(screen.actions));
  if (screen.type === "flip") {
    const copy = questionText(screen.topic, language);
    const contextLines = Object.values(approved.understood).map(entry => entry[language]);
    return approvedContextualQuestion(screen.topic, language, screen.question) && screen.why === copy.why && statusLabels.includes(screen.statusLabel)
      && branchesAreApproved(screen.branches) && (screen.context ?? []).every(line => contextLines.includes(line));
  }
  if (screen.type === "result") {
    const reasonLines = Object.values(reasons).map(entry => entry[language]);
    const confidenceLines = Object.values(approved.confidence).map(entry => entry[language]);
    return statusLabels.includes(screen.statusLabel) && confidenceLines.includes(screen.confidence)
      && reasonLines.includes(screen.reason) && screen.steps.every(step => stepLines.includes(step))
      && (screen.branches === null || branchesAreApproved(screen.branches))
      && (screen.classification === null || isApprovedIncidentCategory(screen.classification, language))
      && (!screen.likelyType || isApprovedIncidentCategory(screen.likelyType, language));
  }
  if (screen.type === "describe") {
    const copy = screen.reason === "link_context" ? linkContextCopy[language] : screen.reason === "greeting" ? approved.describe[language] : approved.offTopic[language];
    return screen.message === copy.message && screen.hint === copy.hint;
  }
  if (screen.type === "evidence") {
    const form = evidenceForm(screen.channel, language);
    return screen.message === form.message && (screen.hint === form.hint || screen.hint === form.retry)
      && JSON.stringify(screen.fields) === JSON.stringify(form.fields);
  }
  if (screen.type === "ask") return screen.question.trim().endsWith("?") && screen.question.length <= 160;
  if (screen.type === "rescue") return stepLines.includes(screen.step.detail);
  return true;
}
