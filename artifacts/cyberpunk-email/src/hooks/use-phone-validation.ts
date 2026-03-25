import { useState, useEffect, useRef } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

export interface PhoneResult {
  valid: boolean;
  digits: string;
  local: string;
  e164: string;
  gatewayEmail?: string;
  reason?: string;
}

export type PhoneState = "idle" | "checking" | "valid" | "invalid";

export function usePhoneValidation(number: string, gateway?: string, debounceMs = 400) {
  const [state, setState] = useState<PhoneState>("idle");
  const [result, setResult] = useState<PhoneResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!number.trim()) {
      setState("idle");
      setResult(null);
      return;
    }

    setState("checking");

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${BASE}/api/verify-phone`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ number, gateway }),
        });
        const data: PhoneResult = await r.json();
        setResult(data);
        setState(data.valid ? "valid" : "invalid");
      } catch {
        setState("idle");
        setResult(null);
      }
    }, debounceMs);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [number, gateway]);

  return { state, result };
}
