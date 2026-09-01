import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "fallback-secret";
const COOKIE = "sb_session";
const PUBLIC  = ["/login", "/api/auth/login"];

function verifyToken(token: string): boolean {
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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // مسیرهای عمومی
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next();

  // بررسی cookie
  const token = req.cookies.get(COOKIE)?.value ?? "";
  if (verifyToken(token)) return NextResponse.next();

  // redirect به صفحه ورود
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
