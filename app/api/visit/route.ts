import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { isEphemeralDeviceId } from "@/lib/device-id";
import { recordVisit } from "@/lib/visitors";

// Fired once per real page load by components/VisitTracker.tsx
// (mounted in the root layout, so it covers every page). Idempotent —
// see lib/visitors.ts's recordVisit — so there's no harm in this
// firing more than once per visitor over time.
export async function POST(req: NextRequest) {
  let body: { deviceId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  // A real, persisted device id is trusted as-is. Anything else —
  // missing, or the ephemeral fallback getDeviceId() returns when
  // localStorage is blocked (a fresh value every call, not a stable
  // identity) — falls back to IP instead of overcounting one visitor
  // as many.
  const key =
    deviceId && !isEphemeralDeviceId(deviceId)
      ? `device:${deviceId}`
      : `ip:${getClientIp(req)}`;

  try {
    await recordVisit(key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/visit] failed:", err);
    // A visitor count is a nice-to-have — fail quietly, no need to
    // alarm the client.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
