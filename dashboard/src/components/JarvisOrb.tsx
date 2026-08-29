"use client";

import { useEffect, useRef } from "react";

export default function JarvisOrb() {
  const id = "jarvis-orb";
  return (
    <>
      <style>{`
        @keyframes jarvis-spin-cw  { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
        @keyframes jarvis-spin-ccw { from { transform: rotate(0deg);   } to { transform: rotate(-360deg); } }
        @keyframes jarvis-spin-x   { from { transform: rotateX(0deg) rotateY(30deg); } to { transform: rotateX(360deg) rotateY(30deg); } }
        @keyframes jarvis-pulse    { 0%,100% { opacity: 0.55; r: 38; } 50% { opacity: 1; r: 44; } }
        @keyframes jarvis-glow     { 0%,100% { opacity: 0.3; } 50% { opacity: 0.75; } }
        @keyframes jarvis-scan     { from { transform: translateY(-80px); opacity:0; } 40%{ opacity:0.7;} to { transform: translateY(80px); opacity:0;} }
        @keyframes jarvis-dot1     { from { transform: rotate(0deg)   translateX(56px) rotate(0deg);   } to { transform: rotate(360deg)  translateX(56px) rotate(-360deg);  } }
        @keyframes jarvis-dot2     { from { transform: rotate(120deg) translateX(56px) rotate(-120deg);} to { transform: rotate(480deg)  translateX(56px) rotate(-480deg); } }
        @keyframes jarvis-dot3     { from { transform: rotate(240deg) translateX(56px) rotate(-240deg);} to { transform: rotate(600deg)  translateX(56px) rotate(-600deg); } }
        @keyframes jarvis-dot4     { from { transform: rotate(60deg)  translateX(76px) rotate(-60deg); } to { transform: rotate(-300deg) translateX(76px) rotate(300deg);  } }
        @keyframes jarvis-dot5     { from { transform: rotate(200deg) translateX(76px) rotate(-200deg);} to { transform: rotate(-160deg) translateX(76px) rotate(160deg);  } }
        @keyframes jarvis-hex      { 0%,100% { opacity:0.06; } 50% { opacity:0.18; } }
        @keyframes jarvis-ring3    { from { transform: rotate3d(1,0.4,0,0deg); } to { transform: rotate3d(1,0.4,0,360deg); } }
        @keyframes jarvis-flicker  { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:0.7} 94%{opacity:1} 97%{opacity:0.85} 98%{opacity:1} }
        #${id} { animation: jarvis-flicker 4s ease-in-out infinite; }
      `}</style>

      <svg id={id} viewBox="-100 -100 200 200" width="220" height="220" xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: "visible", filter: "drop-shadow(0 0 18px rgba(111,224,192,0.35))" }}>
        <defs>
          {/* ambient glow gradient */}
          <radialGradient id="j-core" cx="38%" cy="32%" r="60%">
            <stop offset="0%"   stopColor="#E0FFF5" stopOpacity="0.95" />
            <stop offset="30%"  stopColor="#6FE0C0" stopOpacity="0.85" />
            <stop offset="65%"  stopColor="#1A8A70" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#04251E" stopOpacity="1" />
          </radialGradient>
          <radialGradient id="j-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#6FE0C0" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#6FE0C0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="j-inner" cx="40%" cy="35%" r="55%">
            <stop offset="0%"   stopColor="#ADFFE6" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#0D5A4A" stopOpacity="0" />
          </radialGradient>
          <clipPath id="j-clip">
            <circle cx="0" cy="0" r="44" />
          </clipPath>
          <filter id="j-blur2">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <filter id="j-blur6">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* ── outer ambient glow ── */}
        <circle cx="0" cy="0" r="88" fill="url(#j-glow)"
          style={{ animation: "jarvis-glow 2.4s ease-in-out infinite" }} />

        {/* ── ring 1: CW fast (tilted) ── */}
        <g style={{ animation: "jarvis-spin-cw 3.2s linear infinite", transformOrigin:"0 0" }}>
          <ellipse cx="0" cy="0" rx="72" ry="22" fill="none"
            stroke="#6FE0C0" strokeWidth="0.8" strokeOpacity="0.55"
            strokeDasharray="6 4" />
          {/* ring glow */}
          <ellipse cx="0" cy="0" rx="72" ry="22" fill="none"
            stroke="#6FE0C0" strokeWidth="3" strokeOpacity="0.08" filter="url(#j-blur2)" />
        </g>

        {/* ── ring 2: CCW slower (tilted other axis) ── */}
        <g style={{ animation: "jarvis-spin-ccw 5s linear infinite", transformOrigin:"0 0" }}>
          <ellipse cx="0" cy="0" rx="60" ry="60" fill="none"
            stroke="#D9BE8A" strokeWidth="0.6" strokeOpacity="0.4"
            strokeDasharray="3 9"
            transform="rotate(65)" />
          <ellipse cx="0" cy="0" rx="60" ry="60" fill="none"
            stroke="#D9BE8A" strokeWidth="2.5" strokeOpacity="0.06" filter="url(#j-blur2)"
            transform="rotate(65)" />
        </g>

        {/* ── ring 3: mid equatorial ── */}
        <g style={{ animation: "jarvis-spin-cw 7s linear infinite", transformOrigin:"0 0" }}>
          <ellipse cx="0" cy="0" rx="82" ry="28" fill="none"
            stroke="#6FE0C0" strokeWidth="0.5" strokeOpacity="0.3"
            strokeDasharray="2 8"
            transform="rotate(-20)" />
        </g>

        {/* ── orbiting particle dots on ring1 ── */}
        <g style={{ transformOrigin:"0 0" }}>
          <circle cx="0" cy="0" r="3.5" fill="#6FE0C0"
            style={{ animation: "jarvis-dot1 3.2s linear infinite", transformOrigin:"0 0",
              filter: "drop-shadow(0 0 4px #6FE0C0)" }} />
          <circle cx="0" cy="0" r="2" fill="#ADFFF0"
            style={{ animation: "jarvis-dot2 3.2s linear infinite", transformOrigin:"0 0" }} />
          <circle cx="0" cy="0" r="2.5" fill="#6FE0C0"
            style={{ animation: "jarvis-dot3 3.2s linear infinite", transformOrigin:"0 0" }} />
        </g>

        {/* ── orbiting particles on ring2 (gold) ── */}
        <g style={{ transformOrigin:"0 0" }}>
          <circle cx="0" cy="0" r="2.5" fill="#D9BE8A"
            style={{ animation: "jarvis-dot4 5s linear infinite", transformOrigin:"0 0",
              filter: "drop-shadow(0 0 3px #D9BE8A)" }} />
          <circle cx="0" cy="0" r="1.8" fill="#EDD99A"
            style={{ animation: "jarvis-dot5 5s linear infinite", transformOrigin:"0 0" }} />
        </g>

        {/* ── core sphere shadow / depth ── */}
        <circle cx="4" cy="6" r="42" fill="#021510" opacity="0.6" filter="url(#j-blur6)" />

        {/* ── core sphere ── */}
        <circle cx="0" cy="0" r="42" fill="url(#j-core)" />

        {/* ── inner highlight (specular) ── */}
        <circle cx="0" cy="0" r="42" fill="url(#j-inner)" />

        {/* ── hex grid overlay (clipped to sphere) ── */}
        <g clipPath="url(#j-clip)" style={{ animation: "jarvis-hex 3s ease-in-out infinite" }}>
          {/* hexagonal lattice lines */}
          {[-3,-1,1,3].map((row) =>
            [-3,-1,1,3,5].map((col) => {
              const x = col * 14 - 28;
              const y = row * 16 + (col % 2 === 0 ? 0 : 8) - 24;
              return (
                <polygon key={`${row}-${col}`}
                  points={`${x},${y-9} ${x+7.8},${y-4.5} ${x+7.8},${y+4.5} ${x},${y+9} ${x-7.8},${y+4.5} ${x-7.8},${y-4.5}`}
                  fill="none" stroke="#6FE0C0" strokeWidth="0.4" strokeOpacity="0.6" />
              );
            })
          )}
        </g>

        {/* ── scanning line (clipped) ── */}
        <g clipPath="url(#j-clip)">
          <line x1="-44" y1="0" x2="44" y2="0"
            stroke="#6FE0C0" strokeWidth="0.8" strokeOpacity="0.6"
            style={{ animation: "jarvis-scan 2.8s ease-in-out infinite" }} />
          <line x1="-44" y1="0" x2="44" y2="0"
            stroke="#6FE0C0" strokeWidth="6" strokeOpacity="0.08"
            filter="url(#j-blur2)"
            style={{ animation: "jarvis-scan 2.8s ease-in-out infinite" }} />
        </g>

        {/* ── pulsing center dot ── */}
        <circle cx="0" cy="0" r="6" fill="#ADFFF0" opacity="0.9"
          filter="drop-shadow(0 0 6px #6FE0C0)"
          style={{ animation: "jarvis-glow 1.6s ease-in-out infinite" }} />

        {/* ── HUD arc brackets ── */}
        {[0, 90, 180, 270].map((deg) => (
          <g key={deg} transform={`rotate(${deg})`}>
            <path d="M 50 -8 L 50 0 L 58 0" fill="none"
              stroke="#6FE0C0" strokeWidth="0.8" strokeOpacity="0.5" />
          </g>
        ))}

        {/* ── outer tick marks ── */}
        {Array.from({ length: 36 }, (_, i) => {
          const angle = (i * 10 * Math.PI) / 180;
          const r1 = 86, r2 = i % 3 === 0 ? 80 : 83;
          return (
            <line key={i}
              x1={Math.cos(angle) * r1} y1={Math.sin(angle) * r1}
              x2={Math.cos(angle) * r2} y2={Math.sin(angle) * r2}
              stroke="#6FE0C0" strokeWidth={i % 3 === 0 ? 0.8 : 0.4} strokeOpacity="0.3" />
          );
        })}
      </svg>
    </>
  );
}
