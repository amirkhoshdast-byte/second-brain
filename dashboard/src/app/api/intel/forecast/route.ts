import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

let pool: Pool | null = null;
function db() {
  if (!pool) pool = new Pool({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    max: 4, idleTimeoutMillis: 20000,
  });
  return pool;
}

// رگرسیون خطی وزن‌دار — ماه‌های اخیر وزن بیشتری دارند
function weightedLinearRegression(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 3) return null;

  // وزن نمایی: w_i = exp(0.15 * i)
  const weights = points.map((_, i) => Math.exp(0.15 * i));
  const W = weights.reduce((s, w) => s + w, 0);

  const Wx  = weights.reduce((s, w, i) => s + w * points[i].x, 0);
  const Wy  = weights.reduce((s, w, i) => s + w * points[i].y, 0);
  const Wxx = weights.reduce((s, w, i) => s + w * points[i].x ** 2, 0);
  const Wxy = weights.reduce((s, w, i) => s + w * points[i].x * points[i].y, 0);

  const denom = W * Wxx - Wx * Wx;
  if (Math.abs(denom) < 1e-10) return null;

  const b = (W * Wxy - Wx * Wy) / denom;
  const a = (Wy - b * Wx) / W;

  // خطای استاندارد باقی‌مانده‌ها
  const residuals = points.map(p => p.y - (a + b * p.x));
  const mse = residuals.reduce((s, r) => s + r ** 2, 0) / Math.max(n - 2, 1);
  const stderr = Math.sqrt(mse);

  return { a, b, stderr };
}

function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(y, m - 1 + n, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") ?? null;
  const horizon = Math.min(Number(req.nextUrl.searchParams.get("horizon") ?? 3), 6);

  const c = db();
  try {
    const countryFilter = country ? `AND country = $1` : "";
    const params = country ? [country] : [];

    const { rows: monthlyDocs } = await c.query<{ ym: string; n: number }>(`
      SELECT to_char(date_trunc('month', report_date),'YYYY-MM') ym, count(*)::int n
      FROM intel.document
      WHERE report_date IS NOT NULL ${countryFilter}
      GROUP BY 1 ORDER BY 1 ASC
    `, params);

    const { rows: monthlySignals } = await c.query<{ ym: string; n: number }>(`
      SELECT to_char(date_trunc('month', created_at),'YYYY-MM') ym, count(*)::int n
      FROM intel.signal
      WHERE created_at IS NOT NULL ${country ? `AND country = $1` : ""}
      GROUP BY 1 ORDER BY 1 ASC
    `, params);

    // آخرین ماه جاری احتمالاً ناقص است — از آن برای یادگیری حذف می‌کنیم
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const trainDocs = monthlyDocs.filter(r => r.ym < currentYM);

    // ۱۲ ماه اخیر برای رگرسیون
    const window = trainDocs.slice(-12);
    const points = window.map((r, i) => ({ x: i, y: r.n }));
    const reg = weightedLinearRegression(points);

    // بازه اطمینان ۸۰٪ ≈ ±1.28σ
    const Z80 = 1.28;

    const historical = monthlyDocs.map(r => ({
      ym: r.ym,
      n: r.n,
      type: "actual" as const,
    }));

    const forecast: { ym: string; n: number; lo: number; hi: number; type: "forecast" }[] = [];

    if (reg && window.length >= 3) {
      const lastIdx = window.length - 1;
      for (let h = 1; h <= horizon; h++) {
        const x = lastIdx + h;
        const yHat = Math.max(0, reg.a + reg.b * x);
        const margin = Z80 * reg.stderr * Math.sqrt(1 + h * 0.3); // عدم‌قطعیت افزایشی
        forecast.push({
          ym: addMonths(window[window.length - 1].ym, h),
          n: Math.round(yHat),
          lo: Math.max(0, Math.round(yHat - margin)),
          hi: Math.round(yHat + margin),
          type: "forecast",
        });
      }
    }

    // روند: مثبت/منفی/ثابت بر اساس شیب
    let trend: "up" | "down" | "flat" = "flat";
    let trendPct = 0;
    if (reg) {
      const baseY = reg.a + reg.b * (window.length - 1);
      trendPct = baseY > 0 ? Math.round((reg.b / baseY) * 100) : 0;
      if (trendPct > 5) trend = "up";
      else if (trendPct < -5) trend = "down";
    }

    // سیگنال‌ها هم پیش‌بینی ساده (میانگین متحرک ۳ ماهه)
    const recentSigs = monthlySignals.slice(-3).map(r => r.n);
    const avgSig = recentSigs.length
      ? Math.round(recentSigs.reduce((s, n) => s + n, 0) / recentSigs.length)
      : 0;
    const sigForecast = Array.from({ length: horizon }, (_, i) => ({
      ym: addMonths(currentYM, i),
      n: avgSig,
      type: "forecast" as const,
    }));

    return NextResponse.json({
      country: country ?? "همه کشورها",
      trend,
      trendPct,
      horizon,
      historical,
      forecast,
      signals: {
        historical: monthlySignals,
        forecast: sigForecast,
      },
      model: reg ? { slope: Math.round(reg.b * 10) / 10, intercept: Math.round(reg.a), stderr: Math.round(reg.stderr * 10) / 10 } : null,
    });

  } catch (err) {
    console.error("forecast:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
