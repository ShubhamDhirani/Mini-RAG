1. Retrieval-Augmented Generation (RAG) is an AI architecture that combines **information retrieval** with **text generation**.  
2. Instead of relying solely on an LLM’s internal knowledge, RAG fetches external documents at query time.  
3. This approach ensures answers are **grounded in facts**, reducing hallucination.  
4. The pipeline usually has three steps: **Embed → Retrieve → Generate**.  
5. First, input text is converted into a vector using an **embedding model**.  
6. Each document or chunk in the knowledge base is also stored as vectors in a **vector database**.  
7. A similarity search finds the top-k chunks most relevant to the query.  
8. These chunks are then passed into the **prompt context** of the LLM.  
9. The LLM generates an answer that is supported by the retrieved information.  
10. This makes RAG especially powerful for **domain-specific QA systems**.  
11. Vector databases like **Qdrant**, Pinecone, or Weaviate store and index embeddings.  
12. Embeddings capture **semantic meaning**, not just keywords.  
13. For example, “car” and “automobile” will have embeddings close together in vector space.  
14. In our setup, we use **Qdrant** as the vector DB.  
15. The embedding model used is **all-MiniLM-L6-v2**, producing 384-dimensional vectors.  
16. To avoid redundant results, we apply **Maximal Marginal Relevance (MMR)** reranking.  
17. MMR balances **relevance vs diversity** among retrieved chunks.  
18. This helps when documents are similar and we want coverage of different perspectives.  
19. RAG can be used in chatbots, document search engines, and knowledge assistants.  
20. One key advantage: the knowledge base can be updated without retraining the LLM.  
21. Another benefit: answers can be cited with sources, increasing **trust and transparency**.  
22. RAG reduces the risk of outdated knowledge since the system queries **fresh data**.  
23. Performance depends on embedding quality, retrieval accuracy, and LLM capabilities.  
24. Hybrid search (combining vector + keyword search) can further improve accuracy.  
25. Overall, RAG is a **scalable, modular, and reliable** way to build intelligent systems.  