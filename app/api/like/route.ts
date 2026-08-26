import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { toggleLike } from "@/lib/likes";

export async function POST(req: NextRequest) {
  let body: { submissionId?: unknown; deviceId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const submissionId = Number(body.submissionId);
  const deviceId =
    typeof body.deviceId === "string" ? body.deviceId.trim() : "";

  if (!Number.isInteger(submissionId) || submissionId <= 0 || !deviceId) {
    return NextResponse.json(
      { error: "submissionId and deviceId are required." },
      { status: 400 }
    );
  }

  const ip = getClientIp(req);

  try {
    const result = await toggleLike(submissionId, deviceId, ip);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/like] failed:", err);
    return NextResponse.json({ error: "Couldn't save that." }, { status: 502 });
  }
}
