import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

const BOOT_LINES = [
  "XCRAWL_OS v4.2.1 :: SECURE KERNEL LOADED",
  "Initializing cryptographic modules... [OK]",
  "Mounting encrypted partition /dev/xmail... [OK]",
  "Loading SMTP daemon.................. [OK]",
  "Checking auth subsystem.............. [OK]",
  "CYBER_MAIL service started on :8443",
  "Awaiting operator authentication...",
];

const MATRIX_CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF".split("");

function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    const cols = Math.floor(canvas.width / 16);
    const drops = Array(cols).fill(1);
    const interval = setInterval(() => {
      ctx.fillStyle = "rgba(0,10,2,0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#00ff4120";
      ctx.font = "12px 'Courier New', monospace";
      for (let i = 0; i < drops.length; i++) {
        const ch = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        ctx.fillStyle = drops[i] > 1 ? "#00ff4108" : "#00ff4130";
        ctx.fillText(ch, i * 16, drops[i] * 16);
        if (drops[i] * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }, 60);
    return () => { clearInterval(interval); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, opacity: 0.55, pointerEvents: "none" }} />;
}

function useTypewriter(text: string, speed = 55, delay = 0) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    setDisplayed("");
    let i = 0;
    const timer = setTimeout(() => {
      const iv = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) clearInterval(iv);
      }, speed);
      return () => clearInterval(iv);
    }, delay);
    return () => clearTimeout(timer);
  }, [text, speed, delay]);
  return displayed;
}

function BootSequence({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; });
  useEffect(() => {
    let i = 0;
    let stopped = false;
    let timerId: ReturnType<typeof setTimeout>;
    const show = () => {
      if (stopped) return;
      if (i >= BOOT_LINES.length) {
        setDone(true);
        timerId = setTimeout(() => { if (!stopped) onDoneRef.current(); }, 300);
        return;
      }
      const line = BOOT_LINES[i];
      if (line !== undefined) setVisible(prev => [...prev, line]);
      i++;
      timerId = setTimeout(show, i === 1 ? 120 : 200 + Math.random() * 180);
    };
    timerId = setTimeout(show, 200);
    return () => { stopped = true; clearTimeout(timerId); };
  }, []);
  return (
    <div style={{ fontFamily: "'Fira Code','Courier New',monospace", fontSize: 11, color: "#00ff41", lineHeight: 1.9, padding: "14px 18px" }}>
      {visible.map((line, idx) => (
        <div key={idx} style={{
          opacity: idx === visible.length - 1 && !done ? 1 : 0.55,
          color: line.includes("[OK]") ? "#00cc33" : line.includes("CYBER_MAIL") ? "#00ff41" : "#00ff4188",
        }}>
          <span style={{ color: "#00ff4133" }}>[{String(idx).padStart(2, "0")}]</span>{" "}{line}
        </div>
      ))}
      {!done && <span style={{ animation: "blink 0.8s step-end infinite", color: "#00ff41" }}>█</span>}
    </div>
  );
}

export default function Login() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [booting, setBooting] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const title = useTypewriter("CYBER_MAIL", 70, booting ? 9999 : 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) { triggerShake("Token required"); return; }
    setLoading(true);
    setError("");
    const result = await login(token);
    setLoading(false);
    if (result.success) { navigate("/"); }
    else { triggerShake(result.error ?? "Authentication failed"); }
  };

  const triggerShake = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000a02", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fira Code','Courier New',monospace", position: "relative", overflow: "hidden" }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
        @keyframes scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes glow-pulse { 0%,100%{box-shadow:0 0 6px #00ff4122,inset 0 0 6px #00ff4108} 50%{box-shadow:0 0 18px #00ff4144,inset 0 0 12px #00ff4115} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .login-wrap { animation: glow-pulse 4s ease-in-out infinite; }
        .login-wrap.shake { animation: shake 0.6s ease; }
        .tok-input { caret-color: #00ff41; }
        .tok-input:focus { outline: none; border-color: #00ff41 !important; box-shadow: 0 0 0 1px #00ff4155, 0 0 16px #00ff4122; }
        .auth-btn:hover:not(:disabled) { background: #00ff41 !important; color: #000a02 !important; box-shadow: 0 0 20px #00ff4166 !important; }
        .auth-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .scanline { position:fixed;top:0;left:0;right:0;height:2px;background:linear-gradient(to bottom,transparent,#00ff4110,transparent);animation:scanline 6s linear infinite;pointer-events:none;z-index:1; }
        .form-fade { animation: fadeIn 0.5s ease; }
      `}</style>

      <MatrixRain />
      <div className="scanline" />

      <div style={{ position: "fixed", inset: 0, background: "radial-gradient(ellipse at center, #001a0544 0%, #000a02 70%)", zIndex: 1, pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 520, padding: "0 20px" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, paddingLeft: 4 }}>
          <span style={{ fontSize: 10, color: "#00ff4133", letterSpacing: 1 }}>root@xcrawl-node-07</span>
          <span style={{ color: "#00ff4122" }}>~</span>
          <span style={{ fontSize: 10, color: "#00ff4133" }}>$</span>
          <span style={{ fontSize: 10, color: "#00ff4155", letterSpacing: 1 }}>./cybermail --secure</span>
        </div>

        <div
          className={`login-wrap${shake ? " shake" : ""}`}
          style={{ background: "#020f04", border: "1px solid #00ff4130", position: "relative" }}
        >
          <div style={{ display: "flex", alignItems: "center", background: "#010a02", borderBottom: "1px solid #00ff4118", padding: "8px 14px", gap: 10 }}>
            <div style={{ display: "flex", gap: 5 }}>
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#ff444433", border: "1px solid #ff444466" }} />
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#ffaa0033", border: "1px solid #ffaa0066" }} />
              <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#00ff4122", border: "1px solid #00ff4144" }} />
            </div>
            <span style={{ fontSize: 10, color: "#00ff4144", letterSpacing: 2, flex: 1, textAlign: "center" }}>XCRAWL_SECURE_SHELL — cybermail@auth</span>
            <span style={{ fontSize: 9, color: "#00ff4122", letterSpacing: 1 }}>SSH-2.0</span>
          </div>

          {booting ? (
            <BootSequence onDone={() => { setBooting(false); setTimeout(() => inputRef.current?.focus(), 400); }} />
          ) : (
            <div className="form-fade" style={{ padding: "18px 20px 22px" }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 4, color: "#00ff41", textShadow: "0 0 12px #00ff4155" }}>
                    {title}
                    {title.length < "CYBER_MAIL".length && <span style={{ animation: "blink 0.6s step-end infinite", color: "#00ff41" }}>█</span>}
                  </span>
                </div>
                <div style={{ fontSize: 9, color: "#00ff4133", letterSpacing: 3 }}>EMAIL_CAMPAIGN_PLATFORM — POWERED BY XCRAWL</div>
              </div>

              <div style={{ borderTop: "1px solid #00ff4115", paddingTop: 16 }}>
                <div style={{ fontSize: 9, color: "#00ff4144", letterSpacing: 1, marginBottom: 12, fontStyle: "italic" }}>
                  <span style={{ color: "#00ff4166" }}>system:</span> operator authentication required
                </div>

                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ color: "#00ff4188", fontSize: 11 }}>root@xcrawl</span>
                      <span style={{ color: "#00ff4144", fontSize: 11 }}>:</span>
                      <span style={{ color: "#00aaff88", fontSize: 11 }}>~</span>
                      <span style={{ color: "#00ff4188", fontSize: 11 }}>#</span>
                      <span style={{ fontSize: 10, color: "#00ff4155", letterSpacing: 1 }}>enter token</span>
                    </div>
                    <div style={{ position: "relative" }}>
                      <input
                        ref={inputRef}
                        className="tok-input"
                        type="text"
                        value={token}
                        onChange={e => { setToken(e.target.value); setError(""); }}
                        placeholder="XCR-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
                        autoComplete="off"
                        spellCheck={false}
                        style={{
                          width: "100%", background: "#010802", border: "1px solid #00ff4122",
                          color: "#00ff41", fontFamily: "inherit", fontSize: 11, padding: "10px 12px",
                          letterSpacing: 0.5, boxSizing: "border-box", transition: "all 0.15s",
                        }}
                      />
                    </div>
                  </div>

                  {error && (
                    <div style={{ fontSize: 10, color: "#ff4444", letterSpacing: 1, marginBottom: 12, padding: "7px 10px", background: "#0d0202", border: "1px solid #ff444422" }}>
                      <span style={{ color: "#ff444488" }}>err:</span> {error.toLowerCase()}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="auth-btn" style={{
                    width: "100%", padding: "11px", background: "transparent",
                    border: "1px solid #00ff4155", color: "#00ff41",
                    fontFamily: "inherit", fontSize: 11, fontWeight: 700, letterSpacing: 3,
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {loading ? "AUTHENTICATING..." : "[ AUTHENTICATE ]"}
                  </button>
                </form>

                <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 9, color: "#00ff4122", letterSpacing: 1 }}>SESSION: ENCRYPTED · AES-256</span>
                  <a href="/admin" style={{ fontSize: 9, color: "#00ff4122", letterSpacing: 2, textDecoration: "none", transition: "color 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#00ff4166")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#00ff4122")}>
                    ADMIN_PANEL
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingLeft: 4, paddingRight: 4 }}>
          <span style={{ fontSize: 9, color: "#00ff4122", letterSpacing: 1 }}>XCRAWL SYSTEMS © {new Date().getFullYear()}</span>
          <span style={{ fontSize: 9, color: "#00ff4122", letterSpacing: 1 }}>UNAUTHORIZED ACCESS PROHIBITED</span>
        </div>
      </div>
    </div>
  );
}
