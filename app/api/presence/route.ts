import { NextRequest, NextResponse } from "next/server";
import { pingPresence } from "@/lib/presence";

export async function POST(req: NextRequest) {
  let body: { deviceId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId is required." }, { status: 400 });
  }

  try {
    await pingPresence(deviceId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/presence] failed:", err);
    // Presence is a nice-to-have — fail quietly, no need to alarm the client.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
