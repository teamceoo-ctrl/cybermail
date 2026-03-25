import { useState, useEffect, useCallback } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";
const STORAGE_KEY = "cybermail_token";
const SESSION_KEY = "cybermail_session";

export interface AuthSession {
  token: string;
  label: string;
  plan: string;
  expiresAt: string | null;
  tokenId: number;
  verifiedAt: number;
}

export function useAuth() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) { setLoading(false); return; }
      const parsed: AuthSession = JSON.parse(raw);
      if (parsed.expiresAt && new Date(parsed.expiresAt) < new Date()) {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(STORAGE_KEY);
        setLoading(false);
        return;
      }
      setSession(parsed);
    } catch {
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSession(); }, [loadSession]);

  const login = useCallback(async (token: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`${BASE}/api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (!data.valid) {
        return { success: false, error: data.reason ?? "Authentication failed" };
      }
      const sess: AuthSession = {
        token: token.trim(),
        label: data.label,
        plan: data.plan,
        expiresAt: data.expiresAt,
        tokenId: data.tokenId,
        verifiedAt: Date.now(),
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
      localStorage.setItem(STORAGE_KEY, token.trim());
      setSession(sess);
      return { success: true };
    } catch {
      return { success: false, error: "Connection error — check your network" };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  return { session, loading, login, logout, isAuthenticated: !!session };
}
