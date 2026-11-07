import type { Metadata } from "next";
import { AgentConsole } from "@/components/agent-console";

export const metadata: Metadata = {
  title: "SafeStep Agent Console",
  description: "Simulated DNA support view of approved SafeStep handoffs",
};

export default function AgentPage() {
  return <AgentConsole />;
}
