RAG retrieves relevant chunks from a vector database and feeds them to an LLM.
We use Qdrant as vector DB, embeddings = all-MiniLM-L6-v2 (384 dims).
We apply MMR reranking to pick diverse/relevant chunks before answering.