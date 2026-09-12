"use client";

import { useEffect, useState, useRef } from "react";
import { T } from "@/lib/theme";

type TimelineDoc = {
  id: string; title: string; report_date: string;
  country: string | null; topic: string | null; summary: string | null;
};

export default function DocumentTimeline({
  country, topic, currentId,
}: {
  country?: string | null; topic?: string | null; currentId?: string | null;
}) {
  const [docs, setDocs] = useState<TimelineDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const currentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!country && !topic) { setDocs([]); return; }
    setLoading(true);
    const p = new URLSearchParams();
    if (country) p.set("country", country);
    if (topic)   p.set("topic", topic);
    if (currentId) p.set("id", currentId);
    fetch(`/api/intel/timeline?${p}`)
      .then(r => r.json())
      .then(d => { setDocs(d.docs ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [country, topic, currentId]);

  // اسکرول به سند جاری
  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [docs, currentId]);

  if (!country && !topic) return null;

  const label = country ?? topic ?? "";

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${T.hair}`, paddingTop: 12 }}>
      <p style={{ fontSize: 9, fontWeight: 700, color: T.t3, letterSpacing: ".06em",
        textTransform: "uppercase", margin: "0 0 10px" }}>
        خط زمانی · {label}
        {docs.length > 0 && <span style={{ fontWeight: 400, marginRight: 6 }}>({docs.length} سند)</span>}
      </p>

      {loading && <p style={{ fontSize: 10, color: T.t3 }}>در حال بارگذاری…</p>}

      {!loading && docs.length === 0 && (
        <p style={{ fontSize: 10, color: T.t3 }}>سندی با تاریخ ثبت‌شده یافت نشد.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
        {/* خط عمودی */}
        {docs.length > 1 && (
          <div style={{ position: "absolute", right: 7, top: 8, bottom: 8, width: 1,
            background: T.hair, zIndex: 0 }} />
        )}

        {docs.map((d, i) => {
          const isCurrent = d.id === currentId;
          const isFirst = i === 0;
          const isLast = i === docs.length - 1;
          void isFirst; void isLast;

          return (
            <div key={d.id} ref={isCurrent ? currentRef : null}
              style={{ display: "flex", gap: 10, alignItems: "flex-start",
                paddingBottom: i < docs.length - 1 ? 10 : 0, position: "relative", zIndex: 1 }}>
              {/* نقطه */}
              <div style={{
                width: 15, height: 15, borderRadius: "50%", flexShrink: 0,
                background: isCurrent ? T.gold : "rgba(255,255,255,0.08)",
                border: `2px solid ${isCurrent ? T.gold : T.hair}`,
                marginTop: 1,
              }} />

              <div style={{ flex: 1, minWidth: 0,
                padding: isCurrent ? "6px 8px" : "0",
                borderRadius: isCurrent ? T.rCard : 0,
                background: isCurrent ? `${T.gold}0c` : "transparent",
                border: isCurrent ? `1px solid ${T.goldLine}` : "1px solid transparent",
              }}>
                <p style={{ fontSize: 9, color: T.t3, margin: "0 0 2px", fontVariantNumeric: "tabular-nums" }}>
                  {d.report_date?.slice(0, 10) ?? "—"}
                  {isCurrent && <span style={{ color: T.gold, marginRight: 6, fontWeight: 700 }}>← جاری</span>}
                </p>
                <p style={{ fontSize: 10.5, color: isCurrent ? T.t1 : T.t2, fontWeight: isCurrent ? 600 : 400,
                  margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {d.title ?? "—"}
                </p>
                {isCurrent && d.summary && (
                  <p style={{ fontSize: 9.5, color: T.t3, margin: "4px 0 0", lineHeight: 1.5,
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    overflow: "hidden" }}>
                    {d.summary}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
