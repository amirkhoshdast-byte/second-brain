"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { T } from "@/lib/theme";

type Msg = { role: "user" | "assistant"; text: string };

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: { [index: number]: { transcript: string }; isFinal: boolean };
}

function useSpeechRecognition() {
  const recRef = useRef<SpeechRecognition | null>(null);

  const create = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.lang = "fa-IR";
    r.continuous = false;
    r.interimResults = true;
    recRef.current = r;
    return r;
  }, []);

  return { create, recRef };
}

function speak(text: string, onEnd?: () => void) {
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "fa-IR";
  utt.rate = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const fa = voices.find(v => v.lang.startsWith("fa")) ?? voices.find(v => v.lang.startsWith("ar"));
  if (fa) utt.voice = fa;
  if (onEnd) utt.onend = onEnd;
  window.speechSynthesis.speak(utt);
}

export default function VoiceAssistant({ onClose }: { onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [status, setStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [interim, setInterim] = useState("");
  const [history, setHistory] = useState<{ role: string; content: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { create } = useSpeechRecognition();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, interim]);

  const startListening = useCallback(() => {
    if (status !== "idle") return;
    window.speechSynthesis.cancel();
    const rec = create();
    if (!rec) {
      alert("مرورگر شما از تشخیص صدا پشتیبانی نمی‌کند");
      return;
    }

    setStatus("listening");
    setInterim("");

    rec.onresult = (e) => {
      let final = "";
      let inter = "";
      for (let i = 0; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else inter += t;
      }
      setInterim(inter);
      if (final) {
        setInterim("");
        rec.stop();
        handleQuery(final.trim());
      }
    };

    rec.onerror = (e) => {
      console.error("speech error:", e.error);
      setStatus("idle");
      setInterim("");
    };

    rec.onend = () => {
      if (status === "listening") setStatus("idle");
    };

    rec.start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, history]);

  const handleQuery = useCallback(async (text: string) => {
    if (!text) return;
    const userMsg: Msg = { role: "user", text };
    setMsgs(prev => [...prev, userMsg]);
    setStatus("thinking");

    const newHistory = [...history, { role: "user", content: text }];

    try {
      const res = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text, history }),
      });

      const data = await res.json();
      const answer: string = data.answer ?? data.error ?? "پاسخی دریافت نشد";
      const assistantMsg: Msg = { role: "assistant", text: answer };

      setMsgs(prev => [...prev, assistantMsg]);
      setHistory([...newHistory, { role: "assistant", content: answer }]);
      setStatus("speaking");
      speak(answer, () => setStatus("idle"));
    } catch {
      const errMsg: Msg = { role: "assistant", text: "خطا در دریافت پاسخ" };
      setMsgs(prev => [...prev, errMsg]);
      setStatus("idle");
    }
  }, [history]);

  const statusLabel = {
    idle: "برای صحبت لمس کنید",
    listening: "در حال گوش دادن…",
    thinking: "در حال جستجو در اسناد…",
    speaking: "در حال پاسخ دادن…",
  }[status];

  const pulseColor = {
    idle: T.t4,
    listening: T.mint,
    thinking: T.gold,
    speaking: T.lavender,
  }[status];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "flex-end",
      padding: "0 0 32px",
    }}>
      {/* دکمه بستن */}
      <button onClick={onClose} style={{
        position: "absolute", top: 20, left: 20,
        background: "transparent", border: "none",
        color: T.t3, fontSize: 22, cursor: "pointer",
      }}>✕</button>

      {/* تاریخچه مکالمه */}
      <div style={{
        width: "100%", maxWidth: 680,
        flex: 1, overflowY: "auto",
        padding: "60px 24px 24px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        {msgs.length === 0 && (
          <div style={{
            textAlign: "center", color: T.t4, fontSize: 13,
            marginTop: "auto", paddingBottom: 40,
          }}>
            سوالی بپرسید — از محتوای اسناد پاسخ می‌دهم
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{
            display: "flex",
            justifyContent: m.role === "user" ? "flex-end" : "flex-start",
          }}>
            <div style={{
              maxWidth: "80%",
              background: m.role === "user"
                ? `${T.mint}22`
                : `${T.surface}ee`,
              border: `1px solid ${m.role === "user" ? T.mint + "44" : T.hair}`,
              borderRadius: m.role === "user"
                ? "18px 18px 4px 18px"
                : "18px 18px 18px 4px",
              padding: "10px 16px",
              fontSize: 13,
              color: T.t1,
              lineHeight: 1.7,
              direction: "rtl",
            }}>
              {m.text}
            </div>
          </div>
        ))}

        {/* interim در حال گوش دادن */}
        {interim && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{
              maxWidth: "80%",
              background: `${T.mint}11`,
              border: `1px dashed ${T.mint}44`,
              borderRadius: "18px 18px 4px 18px",
              padding: "10px 16px",
              fontSize: 13,
              color: T.t3,
              direction: "rtl",
            }}>
              {interim}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* وضعیت */}
      <div style={{
        fontSize: 11, color: pulseColor,
        marginBottom: 16, letterSpacing: ".06em",
        transition: "color .3s",
      }}>
        {statusLabel}
      </div>

      {/* دکمه میکروفون */}
      <button
        onClick={startListening}
        disabled={status === "thinking"}
        style={{
          width: 80, height: 80,
          borderRadius: "50%",
          background: status === "listening"
            ? `radial-gradient(circle, ${T.mint}44, ${T.mint}22)`
            : status === "speaking"
            ? `radial-gradient(circle, ${T.lavender}44, ${T.lavender}22)`
            : `radial-gradient(circle, ${T.surface}, ${T.bg})`,
          border: `2px solid ${pulseColor}`,
          cursor: status === "thinking" ? "wait" : "pointer",
          fontSize: 32,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: status === "listening"
            ? `0 0 0 12px ${T.mint}22, 0 0 0 24px ${T.mint}11`
            : "none",
          transition: "all .3s",
        }}
      >
        {status === "thinking" ? "⟳" : status === "speaking" ? "🔊" : "🎙️"}
      </button>

      {/* پاک کردن مکالمه */}
      {msgs.length > 0 && (
        <button
          onClick={() => { setMsgs([]); setHistory([]); }}
          style={{
            marginTop: 16, background: "transparent",
            border: "none", color: T.t4,
            fontSize: 11, cursor: "pointer",
          }}
        >
          پاک کردن مکالمه
        </button>
      )}
    </div>
  );
}
