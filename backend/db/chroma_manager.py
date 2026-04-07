import chromadb
from chromadb import EmbeddingFunction, Embeddings
from backend.core.config import settings

print(f"Initializing ChromaDB persist dir: {settings.chroma_persist_dir}")
chroma_client = chromadb.PersistentClient(path=settings.chroma_persist_dir)


class GeminiEmbeddingFunction(EmbeddingFunction):
    """
    Custom ChromaDB EmbeddingFunction using google-genai SDK directly.
    Avoids the broken ONNX local model and the deprecated google-generativeai package.
    """
    def __init__(self, api_key: str, model: str = "gemini-embedding-001"):
        self._client = None
        self._model = model
        if api_key and api_key.strip() and api_key != "your_gemini_api_key_here":
            try:
                from google import genai
                self._client = genai.Client(api_key=api_key)
            except Exception:
                pass

    def __call__(self, input: list[str]) -> Embeddings:
        embeddings = []
        for text in input:
            result = self._client.models.embed_content(
                model=self._model,
                contents=text,
            )
            embeddings.append(result.embeddings[0].values)
        return embeddings


gemini_ef = GeminiEmbeddingFunction(api_key=settings.gemini_api_key)

# v2 collection name so it doesn't conflict with old ONNX-embedded data
collection = chroma_client.get_or_create_collection(
    name="nodemind_brain_v2",
    embedding_function=gemini_ef,
)


def add_node_to_vector_db(node_id: str, content: str, metadata: dict = None):
    """Upserts a node into ChromaDB using Gemini embeddings."""
    if metadata is None:
        metadata = {}

    collection.upsert(
        documents=[content],
        metadatas=[metadata],
        ids=[node_id]
    )
    print(f"Upserted node '{node_id}' into ChromaDB (Gemini embedding)")


def semantic_search(query: str, n_results: int = 5):
    """Semantic nearest-neighbor search using Gemini embeddings."""
    results = collection.query(
        query_texts=[query],
        n_results=n_results
    )
    return results
