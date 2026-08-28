"use client";

import { useEffect, useState } from "react";
import { T } from "@/lib/theme";
import Gauge from "@/components/Gauge";
import {
  type IntelType, type EntityIntel,
  facetsFor, metricOf, SAMPLE, fallbackIntel, typeFa,
} from "@/lib/intel";

/**
 * کارت هوشمندی موجودیت — نمای «یک گره را بفهم».
 *
 * هر گره‌ی مهم گراف می‌تواند این کارت را باز کند. نکته‌ی اصلی این است که
 * سنجه‌ی گیج با نوع موجودیت عوض می‌شود؛ نگاشتش در lib/intel.ts است تا کارت و
 * داشبورد از یک تعریف بخوانند.
 */

type Props = {
  id: string;
  title: string;
  type: IntelType;
  onClose: () => void;
  onShowInGraph?: () => void;
  onAskAssistant?: () => void;
  onOpenDashboard?: () => void;
  related?: Array<{ label: string; kind: string; tone: string }>;
};

const toneOfType: Record<IntelType, string> = {
  country: T.gold, region: T.sky, topic: T.sky, report: T.mint,
  person: T.sky, org: T.sky, event: T.sky, signal: T.lavender,
  risk: T.bad, opportunity: T.ok, mission: T.sky, source: T.mint,
  trend: T.lavender, insight: T.lavender,
};

const trendMark = { up: "↑", down: "↓", flat: "→" };

export default function EntityIntelCard({
  id, title, type, onClose, onShowInGraph, onAskAssistant, onOpenDashboard, related = [],
}: Props) {
  const [intel, setIntel] = useState<EntityIntel>(SAMPLE[id] ?? fallbackIntel(type));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIntel(SAMPLE[id] ?? fallbackIntel(type));
    setLoading(true);
    fetch(`/api/intel/entity?id=${encodeURIComponent(id)}&type=${type}`)
      .then(r => r.json())
      .then(data => {
        if (!data.ready) return;
        setIntel({
          metricLabel: metricOf[type],
          value: data.gaugeValue ?? 0,
          unit: "٪",
          facets: facetsFor(type, data.facetValues ?? [0, 0, 0]),
          metrics: data.metrics ?? fallbackIntel(type).metrics,
          confidence: data.confidence ?? 0,
          trend: data.trend ?? "flat",
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, type]);

  const tone = toneOfType[type];
  // فقط منطقه، کشور و موضوع دامنه‌ی کافی برای یک داشبورد اختصاصی دارند
  const canDrill = type === "region" || type === "country" || type === "topic";

  return (
    <div className="panel anim-fadein" style={{
      width: 348, flexShrink: 0, display: "flex", flexDirection: "column",
      overflow: "hidden", maxHeight: "100%",
    }}>
      {/* سر کارت */}
      <div style={{ padding: "13px 16px", borderBottom: `1px solid ${T.hair}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 9, color: T.t3, margin: 0, letterSpacing: "0.1em" }}>{typeFa[type]}</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: T.t1, margin: "5px 0 0", lineHeight: 1.4 }}>{title}</p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: T.t3, cursor: "pointer",
            fontSize: 16, padding: "0 2px", flexShrink: 0,
          }}>×</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* گیج اصلی */}
        <div style={{ padding: "14px 16px 6px", display: "flex", flexDirection: "column", alignItems: "center", opacity: loading ? 0.55 : 1, transition: "opacity 0.3s" }}>
          <p style={{ fontSize: 10.5, color: T.t2, margin: "0 0 2px" }}>{intel.metricLabel}</p>
          <Gauge value={intel.value} unit={intel.unit} size={196} tone={tone} />
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: -4 }}>
            <span style={{ fontSize: 11, color: tone, fontWeight: 600 }}>{trendMark[intel.trend]}</span>
            <span style={{ fontSize: 9.5, color: T.t3 }}>
              اطمینان {intel.confidence > 0 ? `${intel.confidence}٪` : "—"}
            </span>
          </div>
        </div>

        {/* سه بُعد فرعی — معنایشان با نوع عوض می‌شود */}
        <div style={{ padding: "10px 16px 0", display: "flex", gap: 7 }}>
          {intel.facets.map((f) => (
            <div key={f.label} style={{ flex: 1, minWidth: 0 }}>
              <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <div style={{ width: `${f.value}%`, height: "100%", background: f.tone, borderRadius: 2 }} />
              </div>
              <p style={{ fontSize: 8.5, color: T.t3, margin: "6px 0 0", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {f.label}
              </p>
              <p style={{ fontSize: 10, color: f.tone, margin: "1px 0 0", textAlign: "center", fontWeight: 600 }}>
                {f.value > 0 ? `${f.value}٪` : "—"}
              </p>
            </div>
          ))}
        </div>

        {/* شاخص‌ها */}
        <div style={{ padding: "16px 16px 0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
          {intel.metrics.map(([v, label], i) => (
            <div key={i} style={{
              background: "rgba(0,0,0,0.22)", border: `1px solid ${T.hair}`,
              borderRadius: T.rCtl, padding: "8px 9px", minWidth: 0,
            }}>
              <p style={{
                fontSize: 14, fontWeight: 300, color: T.t1, margin: 0, lineHeight: 1.1,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{v}</p>
              <p style={{
                fontSize: 8.5, color: T.t3, margin: "4px 0 0",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{label}</p>
            </div>
          ))}
        </div>

        {/* هوش مرتبط */}
        {related.length > 0 && (
          <div style={{ padding: "16px 16px 0" }}>
            <p style={{ fontSize: 10.5, color: T.t1, fontWeight: 600, margin: "0 0 8px" }}>هوش مرتبط</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {related.slice(0, 5).map((r, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 9px", borderRadius: T.rCtl,
                  background: "rgba(0,0,0,0.18)", border: `1px solid ${T.hair}`,
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: r.tone, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: T.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                  </span>
                  <span style={{ fontSize: 8.5, color: T.t3, flexShrink: 0 }}>{r.kind}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ height: 14 }} />
      </div>

      {/* اقدام‌ها */}
      <div style={{ padding: 11, borderTop: `1px solid ${T.hair}`, display: "flex", flexDirection: "column", gap: 6 }}>
        {canDrill && (
          <button onClick={onOpenDashboard} style={primaryBtn}>باز کردن داشبورد</button>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          {[
            ["مشاهده در گراف", onShowInGraph],
            ["گزارش‌های مرتبط", undefined],
            ["تحلیل با دستیار", onAskAssistant],
          ].map(([label, fn]) => (
            <button key={label as string} onClick={fn as (() => void) | undefined} style={ghostBtn}>
              {label as string}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  width: "100%", background: T.goldDim, border: `1px solid ${T.goldLine}`,
  color: T.gold, borderRadius: T.rCtl, padding: "8px 0",
  fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "YekanBakh, sans-serif",
};

const ghostBtn: React.CSSProperties = {
  flex: 1, background: "transparent", border: `1px solid ${T.hair}`,
  color: T.t2, borderRadius: T.rCtl, padding: "7px 0",
  fontSize: 9.5, cursor: "pointer", fontFamily: "YekanBakh, sans-serif",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};
