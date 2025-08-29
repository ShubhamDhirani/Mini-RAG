import os, uuid, re, glob
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.http import models
from sentence_transformers import SentenceTransformer

load_dotenv()
COLL = os.getenv("QDRANT_COLLECTION", "docs")
client = QdrantClient(url=os.getenv("QDRANT_URL"), api_key=os.getenv("QDRANT_API_KEY"))
model_name = os.getenv("EMBED_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
model = SentenceTransformer(model_name)
DIM = model.get_sentence_embedding_dimension()

# ensure collection exists (or create with correct vector size + cosine)
try:
    client.get_collection(COLL)
except Exception:
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
    points = []
    for chunk, pos in chunks(text):
        vec = model.encode(chunk).tolist()
        points.append(models.PointStruct(
            id=str(uuid.uuid4()),
            vector=vec,
            payload={"source": path, "title": title, "position": pos, "text": chunk}
        ))
    if points:
        client.upsert(COLL, points=points)
        print(f"Indexed {len(points)} chunks from {path}")

if __name__ == "__main__":
    files = glob.glob(os.path.join(os.path.dirname(__file__), "..", "seed_docs", "*"))
    if not files:
        print("No files in seed_docs/. Add .md or .txt files and re-run.")
    for p in files:
        upsert_file(p)
    print("Done.")