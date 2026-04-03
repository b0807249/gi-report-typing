import { useState, useEffect } from "react";
import EgdReport from "./EgdReport.jsx";

// ─── Password config ─────────────────────────────────────────────
// Change this or use VITE_APP_PASSWORD env variable in .env file
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD || "chimei2026";

// Session duration: 7 days (in milliseconds)
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

function App() {
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const session = localStorage.getItem("egd_session");
    if (session) {
      try {
        const { expiry } = JSON.parse(session);
        if (Date.now() < expiry) {
          setAuthed(true);
        } else {
          localStorage.removeItem("egd_session");
        }
      } catch {
        localStorage.removeItem("egd_session");
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    if (input === APP_PASSWORD) {
      localStorage.setItem(
        "egd_session",
        JSON.stringify({ expiry: Date.now() + SESSION_DURATION })
      );
      setAuthed(true);
      setError(false);
    } else {
      setError(true);
      setInput("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("egd_session");
    setAuthed(false);
    setInput("");
  };

  if (loading) return null;

  if (authed) {
    return (
      <div style={{ position: "relative" }}>
        <div
          style={{
            position: "fixed",
            top: 14,
            right: 20,
            zIndex: 9999,
            display: "flex",
            gap: 8,
          }}
        >
          <a
            href="https://www.notion.so/1e4106028a148035afa6f5e401bb4d3b"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "5px 12px",
              borderRadius: 5,
              border: "1px solid #1e2d4a",
              background: "rgba(17, 26, 46, 0.9)",
              color: "#e2e8f0",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
              backdropFilter: "blur(8px)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            📋 Notion
          </a>
          <a
            href="https://www.notion.so/EGD-PES-1ea106028a14809e9dcdde8b3bd3b933"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "5px 12px",
              borderRadius: 5,
              border: "1px solid #1e2d4a",
              background: "rgba(17, 26, 46, 0.9)",
              color: "#e2e8f0",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
              backdropFilter: "blur(8px)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            🔬 EGD/PES
          </a>
          <button
            onClick={handleLogout}
            style={{
              padding: "5px 12px",
              borderRadius: 5,
              border: "1px solid #1e2d4a",
              background: "rgba(17, 26, 46, 0.9)",
              color: "#64748b",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "inherit",
              backdropFilter: "blur(8px)",
            }}
          >
            Logout
          </button>
        </div>
        <EgdReport />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b1120",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "'SF Mono','Fira Code','JetBrains Mono','Menlo',monospace",
      }}
    >
      <div
        style={{
          width: 340,
          padding: 32,
          background: "#111a2e",
          borderRadius: 12,
          border: "1px solid #1e2d4a",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔬</div>
          <div
            style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0" }}
          >
            EGD Report Builder
          </div>
          <div
            style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}
          >
            GI Division · Chi Mei Medical Center
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <input
            type="password"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setError(false);
            }}
            placeholder="Enter password"
            autoFocus
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: 8,
              border: `1px solid ${error ? "#ef4444" : "#1e2d4a"}`,
              background: "#0b1120",
              color: "#e2e8f0",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.2s",
            }}
          />
          {error && (
            <div
              style={{
                fontSize: 12,
                color: "#ef4444",
                marginTop: 8,
                textAlign: "center",
              }}
            >
              Incorrect password
            </div>
          )}
          <button
            type="submit"
            style={{
              width: "100%",
              padding: 12,
              marginTop: 16,
              borderRadius: 8,
              border: "none",
              background: "#3b82f6",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "opacity 0.2s",
            }}
          >
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
