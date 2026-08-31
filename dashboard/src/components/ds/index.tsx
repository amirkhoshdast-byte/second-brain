"use client";

/**
 * Design System — مغز دوم سازمانی
 *
 * همه کامپوننت‌ها از CSS variables می‌خوانند و هیچ رنگ hardcode‌ای ندارند.
 * برای استفاده: import { Card, Button, Badge, ... } from "@/components/ds"
 */

import { CSSProperties, ReactNode, forwardRef, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, HTMLAttributes } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tone = "gold" | "mint" | "rose" | "lavender" | "sky" | "ok" | "warn" | "bad";

const TONES: Record<Tone, { color: string; bg: string; border: string }> = {
  gold:     { color: "var(--gold)",     bg: "var(--gold-dim)",        border: "var(--gold-line)" },
  mint:     { color: "var(--mint)",     bg: "rgba(111,224,192,.12)",  border: "rgba(111,224,192,.30)" },
  rose:     { color: "var(--rose)",     bg: "rgba(232,139,168,.10)",  border: "rgba(232,139,168,.28)" },
  lavender: { color: "var(--lavender)", bg: "rgba(169,155,232,.10)",  border: "rgba(169,155,232,.28)" },
  sky:      { color: "var(--sky)",      bg: "rgba(126,200,232,.10)",  border: "rgba(126,200,232,.28)" },
  ok:       { color: "var(--ok)",       bg: "rgba(74,222,156,.08)",   border: "rgba(74,222,156,.25)" },
  warn:     { color: "var(--warn)",     bg: "rgba(232,180,74,.08)",   border: "rgba(232,180,74,.25)" },
  bad:      { color: "var(--bad)",      bg: "rgba(232,105,122,.08)",  border: "rgba(232,105,122,.25)" },
};

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "glass" | "solid" | "ghost";
  padding?: number | string;
  radius?: number | string;
}

export function Card({ variant = "glass", padding = "16px", radius = "var(--r-card)", style, children, ...rest }: CardProps) {
  const base: CSSProperties = {
    borderRadius: radius,
    padding,
    border: `1px solid var(--hair)`,
    ...( variant === "glass"  ? { background: "var(--panel)", backdropFilter: "blur(20px)" } : {}),
    ...( variant === "solid"  ? { background: "var(--panel-solid)" } : {}),
    ...( variant === "ghost"  ? { background: "transparent" } : {}),
    ...style,
  };
  return <div style={base} {...rest}>{children}</div>;
}

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  tone?: Tone;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "ghost", size = "md", tone = "gold", loading, fullWidth, style, children, disabled, ...rest },
  ref
) {
  const t = TONES[tone];
  const sizes = { sm: "7px 13px", md: "9px 18px", lg: "12px 24px" };
  const fontSizes = { sm: 11, md: 12.5, lg: 14 };

  const base: CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
    borderRadius: "var(--r-ctl)", cursor: disabled || loading ? "not-allowed" : "pointer",
    fontFamily: "YekanBakh, sans-serif", fontWeight: 600,
    fontSize: fontSizes[size], padding: sizes[size],
    transition: "all .15s",
    width: fullWidth ? "100%" : undefined,
    opacity: disabled || loading ? 0.5 : 1,
    border: "1px solid transparent",
    ...(variant === "primary" ? {
      background: t.bg, borderColor: t.border, color: t.color,
    } : {}),
    ...(variant === "ghost"   ? {
      background: "transparent", borderColor: "transparent", color: "var(--text-2)",
    } : {}),
    ...(variant === "outline" ? {
      background: "transparent", borderColor: t.border, color: t.color,
    } : {}),
    ...(variant === "danger"  ? {
      background: TONES.bad.bg, borderColor: TONES.bad.border, color: TONES.bad.color,
    } : {}),
    ...style,
  };

  return (
    <button ref={ref} disabled={disabled || loading} style={base} {...rest}>
      {loading && <span className="anim-spin" style={{ width: 12, height: 12, border: `2px solid ${t.border}`, borderTopColor: t.color, borderRadius: "50%", display: "inline-block" }} />}
      {children}
    </button>
  );
});

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  label: string | number;
  tone?: Tone;
  dot?: boolean;
  style?: CSSProperties;
}

export function Badge({ label, tone = "gold", dot, style }: BadgeProps) {
  const t = TONES[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, fontWeight: 600, color: t.color,
      background: t.bg, border: `1px solid ${t.border}`,
      borderRadius: "var(--r-pill)", padding: "3px 10px",
      whiteSpace: "nowrap", ...style,
    }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.color }} />}
      {label}
    </span>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  tone?: Tone;
  style?: CSSProperties;
}

export function MetricCard({ label, value, unit, tone = "gold", style }: MetricCardProps) {
  const t = TONES[tone];
  return (
    <div style={{
      background: "var(--panel)", backdropFilter: "blur(16px)",
      border: `1px solid var(--hair)`,
      borderRadius: "var(--r-card)", padding: "12px 16px",
      position: "relative", overflow: "hidden", ...style,
    }}>
      <div style={{
        position: "absolute", top: 0, right: 0, width: 3, height: "100%",
        background: `linear-gradient(to bottom, ${t.color}88, ${t.color}22)`,
        borderRadius: "0 var(--r-card) var(--r-card) 0",
      }} />
      <p style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 600, margin: "0 0 8px", letterSpacing: ".1em" }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: t.color, margin: 0, lineHeight: 1 }}>
        {value}
      </p>
      {unit && <p style={{ fontSize: 9.5, color: "var(--text-3)", margin: "4px 0 0" }}>{unit}</p>}
    </div>
  );
}

// ─── Stack ────────────────────────────────────────────────────────────────────

interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: "row" | "column";
  gap?: number | string;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
}

export function Stack({ direction = "column", gap = 12, align, justify, style, children, ...rest }: StackProps) {
  return (
    <div style={{ display: "flex", flexDirection: direction, gap, alignItems: align, justifyContent: justify, ...style }} {...rest}>
      {children}
    </div>
  );
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

interface GridProps extends HTMLAttributes<HTMLDivElement> {
  cols?: number | string;
  gap?: number | string;
  minCol?: number;
}

export function Grid({ cols, gap = 12, minCol = 220, style, children, ...rest }: GridProps) {
  const templateCols = cols
    ? (typeof cols === "number" ? `repeat(${cols}, 1fr)` : cols)
    : `repeat(auto-fill, minmax(${minCol}px, 1fr))`;
  return (
    <div style={{ display: "grid", gridTemplateColumns: templateCols, gap, ...style }} {...rest}>
      {children}
    </div>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

export function Divider({ style }: { style?: CSSProperties }) {
  return <div style={{ height: 1, background: "var(--hair)", flexShrink: 0, ...style }} />;
}

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, style, ...rest }, ref) {
  const inputStyle: CSSProperties = {
    background: "rgba(0,0,0,.28)", border: "1px solid var(--hair)",
    borderRadius: "var(--r-ctl)", padding: "9px 13px",
    fontSize: 12, color: "var(--text-1)", fontFamily: "YekanBakh, sans-serif",
    width: "100%", outline: "none", transition: "border-color .15s", ...style,
  };
  if (label) {
    return (
      <div>
        <p style={{ fontSize: 9.5, color: "var(--text-3)", fontWeight: 600, marginBottom: 5 }}>{label}</p>
        <input ref={ref} style={inputStyle} {...rest} />
      </div>
    );
  }
  return <input ref={ref} style={inputStyle} {...rest} />;
});

// ─── Select ───────────────────────────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, style, children, ...rest }, ref) {
  const selectStyle: CSSProperties = {
    background: "rgba(0,0,0,.28)", border: "1px solid var(--hair)",
    borderRadius: "var(--r-ctl)", padding: "9px 13px",
    fontSize: 12, color: "var(--text-1)", fontFamily: "YekanBakh, sans-serif",
    width: "100%", outline: "none", transition: "border-color .15s",
    colorScheme: "dark", appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23566C66' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "left 12px center", ...style,
  };
  if (label) {
    return (
      <div>
        <p style={{ fontSize: 9.5, color: "var(--text-3)", fontWeight: 600, marginBottom: 5 }}>{label}</p>
        <select ref={ref} style={selectStyle} {...rest}>{children}</select>
      </div>
    );
  }
  return <select ref={ref} style={selectStyle} {...rest}>{children}</select>;
});

// ─── PageSection ──────────────────────────────────────────────────────────────

interface PageSectionProps {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  style?: CSSProperties;
}

export function PageSection({ eyebrow, title, action, style }: PageSectionProps) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16, ...style }}>
      <div>
        {eyebrow && <p style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 600, margin: "0 0 4px", letterSpacing: ".12em" }}>{eyebrow}</p>}
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 14, tone = "gold" }: { size?: number; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <span className="anim-spin" style={{
      display: "inline-block", width: size, height: size,
      border: `2px solid ${t.border}`, borderTopColor: t.color,
      borderRadius: "50%",
    }} />
  );
}

// ─── StatusDot ────────────────────────────────────────────────────────────────

export function StatusDot({ tone = "ok", pulse }: { tone?: Tone; pulse?: boolean }) {
  const t = TONES[tone];
  return (
    <span className={pulse ? "anim-dot" : undefined} style={{
      width: 6, height: 6, borderRadius: "50%",
      background: t.color, display: "inline-block", flexShrink: 0,
    }} />
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState({ icon = "◎", title, description }: { icon?: string; title: string; description?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", textAlign: "center", gap: 12 }}>
      <span style={{ fontSize: 28, opacity: 0.4 }}>{icon}</span>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)", margin: 0 }}>{title}</p>
      {description && <p style={{ fontSize: 11.5, color: "var(--text-3)", margin: 0, maxWidth: 280, lineHeight: 1.65 }}>{description}</p>}
    </div>
  );
}
