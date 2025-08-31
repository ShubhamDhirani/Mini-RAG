import React, { useState } from "react";
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
      <h1>Mini RAG Playground</h1>
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
    background: "#fff",
    padding: "24px",
    borderRadius: "12px",
    boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
    fontFamily: "system-ui, sans-serif"
  },
  textarea: {
    width: "100%",
    padding: "12px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    marginBottom: "12px"
  },
  button: {
    padding: "10px 16px",
    border: 0,
    borderRadius: "8px",
    background: "#2b6cb0",
    color: "white",
    cursor: "pointer",
    marginBottom: "16px"
  },
  meta: { marginBottom: "8px", fontSize: "14px", color: "#555" },
  answer: { marginTop: "12px", padding: "12px", background: "#f0f7ff", borderRadius: "8px" }
};

export default App;