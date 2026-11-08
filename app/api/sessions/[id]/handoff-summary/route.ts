import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "../../../../../adapters/session-store";
import { handoffPreview } from "../../../../../adapters/handoff";
import { assess } from "../../../../../engine/assess";
import { handoffDetails, handoffSummary, journeyDestination } from "../../../../../engine/handle-event";

// Simulated support handoff. A session ID is a bearer secret, not agent authentication.
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const headers = { "Cache-Control": "no-store" };
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "invalid_input" }, { status: 400, headers });
  const journey = getSession(id, request.headers.get("x-session-token"))?.journey;
  if (!journey) return NextResponse.json({ error: "session_expired" }, { status: 404, headers });
  if (!journey.handoffApproved) return NextResponse.json({ error: "approval_required" }, { status: 403, headers });
  const destination = journeyDestination(journey);
  if (!destination) return NextResponse.json({ error: "no_handoff" }, { status: 404, headers });
  const result = assess(journey.item, journey.asked);
  const facts = result.confirmedFacts.map(fact => fact.text);
  return NextResponse.json({ simulated: true, ...handoffPreview(destination, result.confirmedFacts, journey.item.language), route: journey.personRoute ?? destination, summary: handoffSummary(journey, facts), details: handoffDetails(journey, facts) }, { headers });
}
