"use client";
import { useEffect, useState } from "react";

type Breakpoint = "mobile" | "tablet" | "desktop";

const BP = { mobile: 640, tablet: 1024 };

function getBreakpoint(w: number): Breakpoint {
  if (w < BP.mobile)  return "mobile";
  if (w < BP.tablet)  return "tablet";
  return "desktop";
}

export function useBreakpoint() {
  const [bp, setBp] = useState<Breakpoint>("desktop");

  useEffect(() => {
    const update = () => setBp(getBreakpoint(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return {
    bp,
    isMobile:  bp === "mobile",
    isTablet:  bp === "tablet",
    isDesktop: bp === "desktop",
    isSmall:   bp !== "desktop",
  };
}
