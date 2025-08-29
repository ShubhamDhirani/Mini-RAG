import os, uuid, re, glob
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.http import models
from fastembed import TextEmbedding

load_dotenv()

# use a new collection name to avoid dim mismatch with any old data
COLL = os.getenv("QDRANT_COLLECTION", "docs")
MODEL_NAME = os.getenv("EMBED_MODEL", "BAAI/bge-small-en-v1.5")

client = QdrantClient(url=os.getenv("QDRANT_URL"), api_key=os.getenv("QDRANT_API_KEY"))
embedder = TextEmbedding(model_name=MODEL_NAME)

# bge-small-en-v1.5 is 384-dimensional
DIM = 384

def ensure_collection():
    try:
        client.get_collection(COLL)
    except Exception:
        pass
    client.recreate_collection(
        collection_name=COLL,
        vectors_config=models.VectorParams(size=DIM, distance=models.Distance.COSINE),
    )

def chunks(txt, size_chars=3200, overlap_chars=320):
    txt = re.sub(r"\s+", " ", txt).strip()
    for i in range(0, len(txt), size_chars - overlap_chars):
        yield txt[i:i+size_chars], i

def upsert_file(path):
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    title = os.path.basename(path)
    texts, payloads = [], []
    for chunk, pos in chunks(text):
        texts.append(chunk)
        payloads.append({"source": path, "title": title, "position": pos, "text": chunk})

    if not texts:
        return
    vectors = list(embedder.embed(texts))  # fastembed returns a generator
    points = [
        models.PointStruct(id=str(uuid.uuid4()), vector=vec, payload=pl)
        for vec, pl in zip(vectors, payloads)
    ]
    client.upsert(COLL, points=points)
    print(f"Indexed {len(points)} chunks from {path}")

if __name__ == "__main__":
    ensure_collection()
    files = glob.glob(os.path.join(os.path.dirname(__file__), "..", "seed_docs", "*"))
    if not files:
        print("No files in seed_docs/. Add .md or .txt files and re-run.")
    for p in files:
        upsert_file(p)
    print("Done.")