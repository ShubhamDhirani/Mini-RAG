import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const BACKEND = process.env.REACT_APP_BACKEND || "http://127.0.0.1:8000";
console.log("Using Backend:",BACKEND);

function App() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dark, setDark] = useState(false);
  const [messages, setMessages] = useState([]);
  const chatEndRef = useRef(null);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth"});
  }, [messages]);


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

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey){
      e.preventDefault();
      ask();
    }
  };

  const ask = async () => {
    const text = q.trim();
    if (!text) return;

    // 1) push user's message
    const userMsg = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);

    // 2) show a temporary assistant "typing…" bubble
    const tempAssistant = { role: "assistant", content: "Thinking…", loading: true };
    setMessages((m) => [...m, tempAssistant]);

    // reset input + old single-answer panel
    setQ("");
    setAnswer("");               // optional: you can keep for copy button if you want
    setLoading(true);

    try {
      const r = await fetch(`${BACKEND}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text })
      });
      const data = await r.json();

            // 3) decide which citations to show and renumber them 1..N
      const rawAnswer = data.answer || "";
      const rawCites  = data.citations || [];

      // try to detect explicit inline citations in the answer like "[1]" or "[2]"
      const explicitlyCited = rawCites.filter(c => rawAnswer.includes(`[${c.i}]`));

      // If none were explicitly referenced, fall back to showing ALL returned citations
      const toShow = explicitlyCited.length > 0 ? explicitlyCited : rawCites;

      // Remap indices to 1..N so UI shows tidy sequential numbers
      const indexMap = new Map(); // old_i -> new_i
      const remappedCites = toShow.map((c, idx) => {
        const newI = idx + 1;
        indexMap.set(c.i, newI);
        return { ...c, i: newI };
      });

      // Rewrite inline bracket numbers in the answer to match the new mapping.
      // If no inline markers existed, this loop will have no effect (safe).
      let remappedAnswer = rawAnswer;
      for (const [oldI, newI] of indexMap.entries()) {
        const re = new RegExp(`\$begin:math:display$${oldI}\\$end:math:display$`, "g");
        remappedAnswer = remappedAnswer.replace(re, `[${newI}]`);
      }

      // If we ended up with zero citations (nothing returned from backend) keep original answer
      if (remappedCites.length === 0) {
        remappedAnswer = rawAnswer;
      }

      // final assistant message
      const finalAssistant = {
        role: "assistant",
        content: remappedAnswer,
        citations: remappedCites,
        meta: { latency: data.latency_ms, tokens: data.token_estimate }
      };

      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = finalAssistant; // replace last temp assistant
        return copy;
      });

      // (keep legacy single-answer fields if you still show them elsewhere)
      setAnswer(data.answer || "");
    } catch (err) {
      // replace the temp assistant with an error bubble
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Request failed. Check backend URL/CORS and server."
        };
        return copy;
      });
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
    {/* Chat transcript */}
    <div style={styles.chat}>
      {messages.map((m, idx) => (
        <div
          key={idx}
          style={m.role === "user" ? styles.userBubble : styles.assistantBubble}
        >
          {m.role === "assistant" ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {m.content}
            </ReactMarkdown>
          ) : (
            <div>{m.content}</div>
          )}

          {/* per-message meta (latency/tokens) */}
          {m.role === "assistant" && m.meta && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
              Latency: {m.meta.latency} ms
              {m.meta.tokens != null ? ` | Tokens: ${m.meta.tokens}` : ""}
            </div>
          )}

          {/* per-message collapsible citations */}
          {m.role === "assistant" && m.citations && m.citations.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Sources</div>
              <ol style={{ paddingLeft: 18, margin: 0 }}>
                {m.citations.map((c) => (
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
                          borderRadius: 8,
                        }}
                      >
                        {c.snippet}
                      </p>
                    </details>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ))}
      <div ref={chatEndRef} />
    </div>

    {/* Clear Button */}
    <div style = {{marginTop: 8}}>
      <button
        onClick={() => setMessages([])}
        style={{ ...styles.button, background: "var(--btn-secondary)" }}
        disabled={messages.length === 0}
      >
        Clear
      </button>  
    </div>
    
      <textarea
        style={styles.textarea}
        rows="5"
        placeholder="Ask a question..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={handleKeyDown}
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
    // Chat styles
  chat: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 12,
    marginBottom: 8,
    maxHeight: "60vh",
    overflowY: "auto",
    paddingRight: 4,
  },
  userBubble: {
    alignSelf: "flex-end",
    background: "#2b6cb0",
    color: "white",
    padding: "10px 12px",
    borderRadius: "12px",
    maxWidth: "80%",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    background: "var(--answer-bg)",
    color: "var(--fg)",
    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid var(--border)",
    maxWidth: "80%",
  },
};

export default App;