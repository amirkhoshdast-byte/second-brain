"use client";
import { useEffect, useState } from "react";
import { T } from "@/lib/theme";

interface ForecastPoint {
  ym: string;
  n: number;
  type: "actual" | "forecast";
  lo?: number;
  hi?: number;
}

interface ForecastData {
  country: string;
  trend: "up" | "down" | "flat";
  trendPct: number;
  historical: ForecastPoint[];
  forecast: ForecastPoint[];
  signals: { historical: { ym: string; n: number }[]; forecast: { ym: string; n: number }[] };
  model: { slope: number; intercept: number; stderr: number } | null;
}

const FA_MONTHS: Record<string, string> = {
  "01": "فر", "02": "ار", "03": "خر", "04": "تی",
  "05": "مر", "06": "شه", "07": "مه", "08": "آب",
  "09": "آذ", "10": "دی", "11": "به", "12": "اس",
};

function shortMonth(ym: string) {
  return FA_MONTHS[ym.slice(5, 7)] ?? ym.slice(5, 7);
}

function TrendBadge({ trend, pct }: { trend: string; pct: number }) {
  const color = trend === "up" ? T.mint : trend === "down" ? "#f87171" : T.t3;
  const arrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const label = trend === "up" ? "صعودی" : trend === "down" ? "نزولی" : "ثابت";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 12px", borderRadius: 99,
      background: `${color}18`, border: `1px solid ${color}55`,
      color, fontSize: 11, fontWeight: 600,
    }}>
      {arrow} روند {label} {Math.abs(pct) > 5 ? `(${Math.abs(pct)}٪ ماهانه)` : ""}
    </span>
  );
}

function BarChart({ points, forecasts, color }: {
  points: { ym: string; n: number }[];
  forecasts: { ym: string; n: number; lo?: number; hi?: number }[];
  color: string;
}) {
  const all = [...points, ...forecasts];
  const maxN = Math.max(...all.map(p => p.hi ?? p.n), 1);
  const H = 120;

  return (
    <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: H + 30 }}>
      {all.map((p, i) => {
        const isForecast = i >= points.length;
        const h = Math.max(3, Math.round((p.n / maxN) * H));
        const loH = p.lo !== undefined ? Math.max(0, Math.round((p.lo / maxN) * H)) : undefined;
        const hiH = p.hi !== undefined ? Math.max(3, Math.round((p.hi / maxN) * H)) : undefined;

        return (
          <div key={p.ym} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1, minWidth: 0 }}>
            <div style={{ position: "relative", width: "100%", height: H, display: "flex", alignItems: "flex-end" }}>
              {/* بازه اطمینان */}
              {isForecast && loH !== undefined && hiH !== undefined && (
                <div style={{
                  position: "absolute", bottom: loH, left: 0, right: 0,
                  height: hiH - loH,
                  background: `${color}18`,
                  borderRadius: 3,
                }} />
              )}
              {/* ستون اصلی */}
              <div style={{
                width: "100%", height: h,
                background: isForecast ? "transparent" : color,
                border: isForecast ? `1.5px dashed ${color}` : "none",
                borderRadius: "3px 3px 0 0",
                opacity: isForecast ? 0.9 : 0.85,
                position: "relative",
              }}>
                {p.n > 0 && (
                  <span style={{
                    position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)",
                    fontSize: 8, color: T.t3, whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                  }}>{p.n}</span>
                )}
              </div>
            </div>
            <span style={{
              fontSize: 8, color: isForecast ? color : T.t4,
              fontWeight: isForecast ? 600 : 400,
              whiteSpace: "nowrap",
            }}>
              {shortMonth(p.ym)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const COUNTRIES = ["", "پاکستان", "افغانستان", "چین", "قزاقستان", "تایلند", "هند", "اندونزی", "عراق", "بنگلادش", "ترکیه"];

export default function ForecastPanel() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("");
  const [horizon, setHorizon] = useState(3);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    params.set("horizon", String(horizon));
    fetch(`/api/intel/forecast?${params}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [country, horizon]);

  const card: React.CSSProperties = {
    background: T.surface,
    border: `1px solid ${T.hair}`,
    borderRadius: 12,
    padding: "16px 20px",
  };

  return (
    <div style={{ padding: "24px 20px", maxWidth: 900, margin: "0 auto", direction: "rtl" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: T.t1, marginBottom: 4 }}>پیش‌بینی روند</h2>
          <p style={{ fontSize: 11, color: T.t3 }}>
            رگرسیون خطی وزن‌دار روی ۱۲ ماه اخیر · بازه اطمینان ۸۰٪
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            style={{
              background: T.surface, border: `1px solid ${T.hair}`,
              color: T.t2, borderRadius: 8, padding: "6px 10px",
              fontSize: 11, cursor: "pointer",
            }}
          >
            {COUNTRIES.map(c => (
              <option key={c} value={c}>{c || "همه کشورها"}</option>
            ))}
          </select>
          <select
            value={horizon}
            onChange={e => setHorizon(Number(e.target.value))}
            style={{
              background: T.surface, border: `1px solid ${T.hair}`,
              color: T.t2, borderRadius: 8, padding: "6px 10px",
              fontSize: 11, cursor: "pointer",
            }}
          >
            <option value={1}>۱ ماه پیش‌بینی</option>
            <option value={3}>۳ ماه پیش‌بینی</option>
            <option value={6}>۶ ماه پیش‌بینی</option>
          </select>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: T.t3 }}>در حال محاسبه…</div>
      )}

      {!loading && data && (
        <>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
            <div style={card}>
              <div style={{ fontSize: 26, fontWeight: 700, color: T.mint, fontVariantNumeric: "tabular-nums" }}>
                {data.historical.reduce((s, p) => s + p.n, 0)}
              </div>
              <div style={{ fontSize: 10, color: T.t4, marginTop: 4 }}>کل اسناد تاریخ‌دار</div>
            </div>
            <div style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <TrendBadge trend={data.trend} pct={data.trendPct} />
              </div>
              <div style={{ fontSize: 10, color: T.t4 }}>
                {data.model ? `شیب: ${data.model.slope > 0 ? "+" : ""}${data.model.slope} سند/ماه` : "داده کافی نیست"}
              </div>
            </div>
            <div style={card}>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#7c6af7", fontVariantNumeric: "tabular-nums" }}>
                {data.forecast[data.forecast.length - 1]?.n ?? "—"}
              </div>
              <div style={{ fontSize: 10, color: T.t4, marginTop: 4 }}>
                پیش‌بینی ماه {data.forecast.length > 0
                  ? shortMonth(data.forecast[data.forecast.length - 1].ym) + " " + data.forecast[data.forecast.length - 1].ym.slice(0, 4)
                  : "—"}
              </div>
            </div>
          </div>

          {/* نمودار اسناد */}
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.t3, marginBottom: 16, letterSpacing: ".06em" }}>
              روند ماهانه اسناد — ستون‌های خطی‌چین پیش‌بینی
            </div>
            <BarChart
              points={data.historical.slice(-14)}
              forecasts={data.forecast}
              color={T.mint}
            />
            {data.forecast.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", gap: 16, fontSize: 9, color: T.t3 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 12, height: 4, background: T.mint, borderRadius: 2, display: "inline-block" }} />
                  داده واقعی
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 12, height: 4, border: `1.5px dashed ${T.mint}`, borderRadius: 2, display: "inline-block" }} />
                  پیش‌بینی (بازه ۸۰٪)
                </span>
              </div>
            )}
          </div>

          {/* جدول پیش‌بینی */}
          {data.forecast.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.t3, marginBottom: 12, letterSpacing: ".06em" }}>
                جزئیات پیش‌بینی
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["ماه", "پیش‌بینی", "حداقل (۸۰٪)", "حداکثر (۸۰٪)", "تغییر نسبت به اخیر"].map(h => (
                      <th key={h} style={{ fontSize: 9, color: T.t4, textAlign: "right", padding: "4px 8px", borderBottom: `1px solid ${T.hair}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.forecast.map((f, i) => {
                    const prev = i === 0
                      ? data.historical[data.historical.length - 1]?.n
                      : data.forecast[i - 1].n;
                    const delta = prev !== undefined ? f.n - prev : null;
                    return (
                      <tr key={f.ym} style={{ background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                        <td style={{ padding: "7px 8px", fontSize: 11, color: "#7c6af7", fontWeight: 600 }}>
                          {shortMonth(f.ym)} {f.ym.slice(0, 4)}
                        </td>
                        <td style={{ padding: "7px 8px", fontSize: 12, color: T.t1, fontVariantNumeric: "tabular-nums" }}>{f.n}</td>
                        <td style={{ padding: "7px 8px", fontSize: 11, color: T.t3, fontVariantNumeric: "tabular-nums" }}>{f.lo ?? "—"}</td>
                        <td style={{ padding: "7px 8px", fontSize: 11, color: T.t3, fontVariantNumeric: "tabular-nums" }}>{f.hi ?? "—"}</td>
                        <td style={{ padding: "7px 8px", fontSize: 11, fontVariantNumeric: "tabular-nums", color: delta === null ? T.t4 : delta > 0 ? T.mint : delta < 0 ? "#f87171" : T.t3 }}>
                          {delta === null ? "—" : delta > 0 ? `+${delta}` : String(delta)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {data.model && (
                <div style={{ marginTop: 10, fontSize: 9, color: T.t4 }}>
                  مدل: y = {data.model.intercept} + {data.model.slope}x · خطای استاندارد: {data.model.stderr}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
