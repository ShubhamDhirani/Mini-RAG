# app.py
import os, time, math
from typing import List
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import numpy as np

from qdrant_client import QdrantClient
from qdrant_client.http import models
from fastembed import TextEmbedding

from groq import Groq

# --- load .env ---
load_dotenv()

# --- FastAPI app with CORS ---
app = FastAPI(title="Mini RAG")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # keep wide for demo; restrict on prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Env / clients ---
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLL = os.getenv("QDRANT_COLLECTION", "docs")
EMBED_MODEL = os.getenv("EMBED_MODEL", "BAAI/bge-small-en-v1.5")

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq")
LLM_MODEL = os.getenv("LLM_MODEL", "llama-3.1-8b-instant")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Vector DB + embedder
client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
embedder = TextEmbedding(model_name=EMBED_MODEL)

# LLM: Groq (free)
groq_client = Groq(api_key=GROQ_API_KEY)

# --- health ---
@app.get("/health")
def health():
    return {"status": "ok"}

# --- schema ---
class QueryIn(BaseModel):
    q: str

# --- utils ---
def normalize(vec: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(vec) + 1e-9
    return vec / n

def mmr(query_vec: np.ndarray, cand_vecs: np.ndarray, k=5, lambda_=0.7) -> List[int]:
    """
    Maximal Marginal Relevance:
    score = λ * sim(q, d) - (1-λ) * max_{s in selected} sim(d, s)
    """
    selected, remaining = [], list(range(cand_vecs.shape[0]))
    sims_q = cand_vecs @ query_vec
    while len(selected) < min(k, len(remaining)):
        best_i, best_score = None, -1e9
        for i in remaining:
            div = 0.0 if not selected else max(cand_vecs[i] @ cand_vecs[j] for j in selected)
            score = lambda_ * sims_q[i] - (1 - lambda_) * div
            if score > best_score:
                best_i, best_score = i, score
        selected.append(best_i)
        remaining.remove(best_i)
    return selected

def call_groq(prompt: str) -> str:
    """Groq chat completion with instruction to ALWAYS cite inline as [1],[2],..."""
    r = groq_client.chat.completions.create(
        model=LLM_MODEL,
        temperature=0.2,
        messages=[
            {"role": "system", "content":
             "You are a grounded QA assistant. Use only the provided sources. "
             "Cite with [1], [2], ... inline. If insufficient info, say you don't know and show the closest sources."},
            {"role": "user", "content": prompt},
        ],
    )
    return r.choices[0].message.content

# --- main RAG route ---
@app.post("/query")
def query(q: QueryIn):
    t0 = time.time()

    # 1) embed query
    qvec = np.array(list(embedder.embed([q.q]))[0])
    qvec = qvec / (np.linalg.norm(qvec) + 1e-9)

    # 2) vector search (top-k)
    results = client.search(
        collection_name=COLL,
        query_vector=qvec.tolist(),
        limit=16,
        with_payload=True,
        with_vectors=True
    )
    if not results:
        return {
            "answer": "I couldn't find any relevant content in the index.",
            "citations": [],
            "latency_ms": int((time.time()-t0)*1000),
            "token_estimate": 0
        }

    # top score heuristic for no-answer
    top_score = results[0].score if hasattr(results[0], "score") else None

    # 3) MMR rerank to pick diverse, relevant 5
    cand_vecs = np.array([normalize(np.array(p.vector)) for p in results])
    order = mmr(qvec, cand_vecs, k=5, lambda_=0.7)
    picked = [results[i] for i in order]

    # 4) Build prompt context + citation map
    ctx_lines, cites = [], []
    for i, p in enumerate(picked, start=1):
        text = p.payload["text"]
        title = p.payload.get("title", "doc")
        source = p.payload.get("source", "")
        snippet = text[:220] + ("..." if len(text) > 220 else "")
        ctx_lines.append(f"[{i}] {text}")
        cites.append({"i": i, "title": title, "source": source, "snippet": snippet})

    prompt = (
        f"Question: {q.q}\n\n"
        "Use only these sources and cite them inline like [1], [2], etc.:\n\n" +
        "\n\n".join(ctx_lines)
    )

    # 5) No-answer branch (very low similarity)
    if top_score is not None and top_score < 0.08:
        answer = (
            "I don't have enough information to answer confidently from the indexed documents. "
            "Here are the closest snippets: " +
            " ".join(f"[{c['i']}] {c['snippet']}" for c in cites[:2])
        )
    else:
        answer = call_groq(prompt)

    latency = int((time.time() - t0) * 1000)
    tok_est = math.ceil((len(prompt) + len(answer)) / 4)

    return {
        "answer": answer,
        "citations": cites,
        "latency_ms": latency,
        "token_estimate": tok_est
    }