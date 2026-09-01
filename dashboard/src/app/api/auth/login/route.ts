import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const PASSWORD = process.env.APP_PASSWORD ?? "";
const SECRET   = process.env.AUTH_SECRET   ?? "fallback-secret";
const COOKIE   = "sb_session";
const MAX_AGE  = 60 * 60 * 24 * 30; // ۳۰ روز

function makeToken(): string {
  const payload = `${Date.now()}:authenticated`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64");
}

export function verifyToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64").toString();
    const parts = decoded.split(":");
    if (parts.length < 3) return false;
    const sig = parts.pop()!;
    const payload = parts.join(":");
    const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
    return sig === expected;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const { password } = await req.json() as { password: string };
  if (!PASSWORD || password !== PASSWORD) {
    return NextResponse.json({ ok: false, error: "رمز اشتباه است" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, makeToken(), {
    httpOnly: true, secure: false, sameSite: "lax",
    maxAge: MAX_AGE, path: "/",
  });
  return res;
}
