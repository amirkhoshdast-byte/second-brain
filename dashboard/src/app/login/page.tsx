"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const d = await res.json();
      setError(d.error ?? "خطای ناشناخته");
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(ellipse at 50% 30%, #061a14 0%, #030907 70%)",
      fontFamily: "YekanBakh, sans-serif", direction: "rtl",
    }}>
      {/* هاله مرکزی */}
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(111,224,192,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{
        width: "min(380px, calc(100vw - 40px))",
        background: "rgba(8,28,22,0.85)",
        border: "1px solid rgba(111,224,192,0.15)",
        borderRadius: 20,
        backdropFilter: "blur(20px)",
        padding: "40px 36px",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 28,
      }}>
        {/* لوگو */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <svg viewBox="-44 -44 88 88" width="52" height="52" xmlns="http://www.w3.org/2000/svg"
            style={{ filter: "drop-shadow(0 0 12px rgba(111,224,192,0.5))" }}>
            <defs>
              <radialGradient id="lg" cx="38%" cy="32%" r="60%">
                <stop offset="0%"   stopColor="#E0FFF5" stopOpacity="0.95" />
                <stop offset="35%"  stopColor="#6FE0C0" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#063D30" stopOpacity="1" />
              </radialGradient>
            </defs>
            <circle cx="0" cy="0" r="40" fill="url(#lg)" />
            <circle cx="0" cy="0" r="14" fill="none" stroke="#6FE0C0" strokeWidth="1"
              strokeOpacity="0.6" strokeDasharray="3 5" />
            <circle cx="0" cy="0" r="4" fill="#ADFFF0" opacity="0.9" />
          </svg>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: "#E0FFF5", margin: 0 }}>مغز دوم سازمانی</p>
            <p style={{ fontSize: 11, color: "rgba(111,224,192,0.5)", margin: "4px 0 0" }}>سازمان فرهنگ و ارتباطات اسلامی</p>
          </div>
        </div>

        {/* فرم */}
        <form onSubmit={submit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, color: "rgba(111,224,192,0.6)", letterSpacing: "0.05em" }}>رمز دسترسی</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              required
              style={{
                background: "rgba(0,0,0,0.35)",
                border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(111,224,192,0.2)"}`,
                borderRadius: 10,
                padding: "11px 14px",
                color: "#E0FFF5",
                fontSize: 15,
                outline: "none",
                fontFamily: "monospace",
                letterSpacing: "0.15em",
                transition: "border-color 0.15s",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(111,224,192,0.5)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = error ? "rgba(239,68,68,0.5)" : "rgba(111,224,192,0.2)"; }}
            />
            {error && <p style={{ fontSize: 10.5, color: "rgba(239,68,68,0.85)", margin: 0 }}>⚠ {error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              background: loading ? "rgba(111,224,192,0.1)" : "rgba(111,224,192,0.15)",
              border: "1px solid rgba(111,224,192,0.35)",
              borderRadius: 10,
              padding: "12px 0",
              color: loading ? "rgba(111,224,192,0.5)" : "#6FE0C0",
              fontSize: 13,
              fontWeight: 600,
              cursor: loading || !password ? "not-allowed" : "pointer",
              fontFamily: "YekanBakh, sans-serif",
              transition: "all 0.15s",
              opacity: !password ? 0.5 : 1,
            }}
          >
            {loading ? "در حال ورود…" : "ورود به سیستم"}
          </button>
        </form>

        <p style={{ fontSize: 9.5, color: "rgba(111,224,192,0.25)", margin: 0, textAlign: "center" }}>
          دسترسی محدود به کاربران مجاز
        </p>
      </div>
    </div>
  );
}
