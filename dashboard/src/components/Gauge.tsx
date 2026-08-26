"use client";

import { T } from "@/lib/theme";

/**
 * گیج نیم‌دایره‌ای مشترک.
 *
 * هم کارت موجودیت و هم داشبورد از همین یکی استفاده می‌کنند تا دو نسخه‌ی
 * موازی شکل نگیرد. کمان از چپ به راست پر می‌شود (۱۸۰° تا ۳۶۰°) که در RTL
 * هم همان حس «رشد به سمت کامل» را می‌دهد.
 */

type Props = {
  /** ۰ تا ۱۰۰ */
  value: number;
  size?: number;
  label?: string;
  unit?: string;
  tone?: string;
  /** خط‌چین‌های مدرج پشت کمان */
  ticks?: boolean;
};

function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const p = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const a = p(from);
  const b = p(to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

export default function Gauge({
  value, size = 190, label, unit = "٪", tone = T.mint, ticks = true,
}: Props) {
  const v = Math.max(0, Math.min(100, value));
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.40;
  const stroke = size * 0.055;
  // نیم‌دایره‌ی بالایی: از ۱۸۰° تا ۳۶۰°
  const end = 180 + (v / 100) * 180;

  const id = `g${Math.round(value)}${Math.round(size)}`;

  return (
    <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={tone} stopOpacity="0.45" />
          <stop offset="100%" stopColor={tone} stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* مدرج‌های پس‌زمینه */}
      {ticks && Array.from({ length: 41 }).map((_, i) => {
        const deg = 180 + (i / 40) * 180;
        const rad = (deg * Math.PI) / 180;
        const inner = r + stroke * 0.85;
        const outer = inner + (i % 5 === 0 ? size * 0.045 : size * 0.026);
        const on = (i / 40) * 100 <= v;
        return (
          <line
            key={i}
            x1={cx + inner * Math.cos(rad)} y1={cy + inner * Math.sin(rad)}
            x2={cx + outer * Math.cos(rad)} y2={cy + outer * Math.sin(rad)}
            stroke={on ? tone : T.hair2}
            strokeWidth={i % 5 === 0 ? 1.3 : 0.8}
            strokeOpacity={on ? 0.55 : 0.5}
          />
        );
      })}

      {/* شیار خالی */}
      <path d={arc(cx, cy, r, 180, 360)} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} strokeLinecap="round" />

      {/* کمان پرشده */}
      {v > 0 && (
        <path d={arc(cx, cy, r, 180, end)} fill="none"
          stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${tone}55)` }} />
      )}

      {/* عدد مرکزی */}
      <text x={cx} y={cy - size * 0.04} textAnchor="middle"
        style={{ fontSize: size * 0.235, fontWeight: 300, fill: T.t1, fontFamily: "YekanBakh, sans-serif" }}>
        {value > 0 ? value : "—"}
        <tspan style={{ fontSize: size * 0.09, fill: T.t2 }}>{value > 0 ? unit : ""}</tspan>
      </text>
      {label && (
        <text x={cx} y={cy + size * 0.075} textAnchor="middle"
          style={{ fontSize: size * 0.062, fill: T.t3, fontFamily: "YekanBakh, sans-serif" }}>
          {label}
        </text>
      )}
    </svg>
  );
}
