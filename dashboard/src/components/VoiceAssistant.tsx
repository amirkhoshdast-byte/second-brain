"use client";
import { useRef, useState, useCallback } from "react";
import { T } from "@/lib/theme";

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
interface SpeechRecognition extends EventTarget {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  length: number;
  [i: number]: { [j: number]: { transcript: string }; isFinal: boolean };
}

interface Props {
  onResult: (text: string) => void;
  onClose: () => void;
}

export default function VoiceAssistant({ onResult, onClose }: Props) {
  const [phase, setPhase] = useState<"ready" | "listening" | "done" | "error">("ready");
  const [interim, setInterim] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const recRef = useRef<SpeechRecognition | null>(null);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) {
      setErrMsg("مرورگر شما از تشخیص صدا پشتیبانی نمی‌کند — Chrome را امتحان کنید");
      setPhase("error");
      return;
    }

    const rec = new SR();
    rec.lang = "fa-IR";
    rec.continuous = false;
    rec.interimResults = true;
    recRef.current = rec;

    let collected = "";
    setPhase("listening");
    setInterim("");

    rec.onresult = (e) => {
      let all = "";
      for (let i = 0; i < e.results.length; i++) all += e.results[i][0].transcript;
      collected = all;
      setInterim(all);
    };

    rec.onerror = (e) => {
      recRef.current = null;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setErrMsg("دسترسی میکروفون رد شد — در نوار آدرس Chrome روی 🔒 کلیک کنید و Allow کنید");
      } else if (e.error === "no-speech") {
        setErrMsg("چیزی شنیده نشد — دوباره امتحان کنید");
      } else {
        setErrMsg(`خطا: ${e.error}`);
      }
      setPhase("error");
    };

    rec.onend = () => {
      recRef.current = null;
      const text = collected.trim();
      if (text) {
        setPhase("done");
        setTimeout(() => { onResult(text); onClose(); }, 500);
      } else if (phase !== "error") {
        setErrMsg("چیزی شنیده نشد — دوباره امتحان کنید");
        setPhase("error");
      }
    };

    rec.start();
  }, [onResult, onClose, phase]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* دایره اصلی */}
      <div style={{ position: "relative", width: 110, height: 110 }}>
        {phase === "listening" && (
          <>
            <div style={{ position:"absolute", inset:-14, borderRadius:"50%", border:`2px solid ${T.mint}33`, animation:"ripple 1.5s ease-out infinite" }} />
            <div style={{ position:"absolute", inset:-6, borderRadius:"50%", border:`2px solid ${T.mint}55`, animation:"ripple 1.5s .5s ease-out infinite" }} />
          </>
        )}
        <div style={{
          width: 110, height: 110, borderRadius: "50%",
          background: phase === "done" ? `${T.mint}22`
            : phase === "error" ? "#f8717122"
            : phase === "listening" ? `${T.mint}18`
            : `${T.surface}`,
          border: `2px solid ${
            phase === "done" ? T.mint
            : phase === "error" ? "#f87171"
            : phase === "listening" ? T.mint + "99"
            : T.hair}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 40, cursor: phase === "ready" ? "pointer" : "default",
          transition: "all .3s",
        }}
          onClick={phase === "ready" ? startListening : undefined}
        >
          {phase === "done" ? "✓" : phase === "error" ? "✕" : "🎙️"}
        </div>
      </div>

      {/* متن */}
      <div style={{ textAlign: "center", direction: "rtl", maxWidth: 360 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, marginBottom: 8,
          color: phase === "error" ? "#f87171" : T.t1,
        }}>
          {phase === "ready" && "روی میکروفون کلیک کنید و صحبت کنید"}
          {phase === "listening" && "در حال گوش دادن…"}
          {phase === "done" && "دریافت شد — در حال ارسال…"}
          {phase === "error" && errMsg}
        </div>

        {interim && phase === "listening" && (
          <div style={{ fontSize: 12, color: T.mint, lineHeight: 1.8 }}>{interim}</div>
        )}
      </div>

      {/* دکمه‌ها */}
      {phase === "error" && (
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { setPhase("ready"); setErrMsg(""); setInterim(""); }} style={{
            background: `${T.mint}22`, border: `1px solid ${T.mint}55`,
            color: T.mint, borderRadius: 8, padding: "7px 18px", fontSize: 12, cursor: "pointer",
          }}>دوباره امتحان</button>
          <button onClick={onClose} style={{
            background: "transparent", border: `1px solid ${T.hair}`,
            color: T.t3, borderRadius: 8, padding: "7px 18px", fontSize: 12, cursor: "pointer",
          }}>بستن</button>
        </div>
      )}

      {(phase === "ready" || phase === "listening") && (
        <button onClick={onClose} style={{
          background: "transparent", border: "none",
          color: T.t4, fontSize: 11, cursor: "pointer",
        }}>لغو</button>
      )}

      <style>{`
        @keyframes ripple {
          0% { transform:scale(1); opacity:1; }
          100% { transform:scale(1.6); opacity:0; }
        }
      `}</style>
    </div>
  );
}
