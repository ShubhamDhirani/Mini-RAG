import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const BACKEND = process.env.REACT_APP_BACKEND || "http://127.0.0.1:8000";
console.log("Using Backend:",BACKEND);

function App() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState([]);
  const [meta, setMeta] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [dark]);

  function copyAnswer() {
    if (!answer) return;
    navigator.clipboard.writeText(answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 3200);
  }

  const ask = async () => {
    if (!q.trim()) return;
    setLoading(true);
    setAnswer("Thinking...");
    setCitations([]);
    setMeta("");

    try {
      const r = await fetch(`${BACKEND}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q })
      });
      const data = await r.json();
      setAnswer(data.answer || "");
      setCitations(data.citations || []);
      setMeta(`Latency: ${data.latency_ms} ms | Token est: ${data.token_estimate}`);
    } catch (err) {
      setAnswer("Request failed. Check backend URL/CORS and server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Mini RAG Playground</h1>
        <button
          onClick={() => setDark((v) => !v)}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: 0,
            background: "var(--btn-secondary)",
            color: "white",
            cursor: "pointer"
          }}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>
      <textarea
        style={styles.textarea}
        rows="5"
        placeholder="Ask a question..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <button style={styles.button} onClick={ask} disabled={loading}>
        {loading ? "Loading..." : "Ask"}
      </button>
      <button
        style={{ ...styles.button, background: "#6b7280"}}
        onClick={copyAnswer}
        disabled = {!answer || loading}
      >
        Copy answer
      </button>  
      {copied && <span style={{ marginLeft: 8, color: "#555"}}>Copied!</span>}
      <div style={styles.meta}>{meta}</div>
      {answer && (
        <div style={styles.answer}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {answer}
          </ReactMarkdown>
        </div>
      )}
      {citations && citations.length > 0 && (
  <>
    <h3>Sources</h3>
    <ol style={{ paddingLeft: 18 }}>
      {citations.map((c) => (
        <li key={c.i} style={{ marginBottom: 8 }}>
          <details>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              [{c.i}] {c.title}{" "}
              <span style={{ color: "#666", fontWeight: 400 }}>
                — {c.source ? c.source.split("/").pop() : ""}
              </span>
            </summary>
            <p
              style={{
                marginTop: 8,
                color: "#555",
                background: "#f6f7f9",
                padding: "8px 10px",
                borderRadius: 8
              }}
            >
              {c.snippet}
            </p>
          </details>
        </li>
      ))}
    </ol>
  </>
)}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "800px",
    margin: "40px auto",
    background: "var(--card)",
    padding: "24px",
    borderRadius: "12px",
    boxShadow: "var(--shadow)",
    fontFamily: "system-ui, sans-serif",
  },
  textarea: {
    width: "100%",
    padding: "12px",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    marginBottom: "12px",
    background: "var(--bg)",
    color: "var(--fg)",
  },
  button: {
    padding: "10px 16px",
    border: 0,
    borderRadius: "8px",
    background: "var(--btn)",
    color: "white",
    cursor: "pointer",
    marginRight: "8px",
    marginBottom: "16px",
  },
  meta: { marginBottom: "8px", fontSize: "14px", color: "var(--muted)" },
  answer: {
    marginTop: "12px",
    padding: "12px",
    background: "var(--answer-bg)",
    borderRadius: "8px",
  },
};

export default App;