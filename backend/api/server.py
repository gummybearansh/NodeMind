import os
from fastapi import FastAPI, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from backend.api.websockets import manager
from backend.db.mongo_manager import connect_to_mongo, close_mongo_connection
from backend.db.chroma_manager import semantic_search

app = FastAPI(title="NodeMind API")

# Allow CORS for local interaction
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PromptRequest(BaseModel):
    prompt: str

@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()
    print("NodeMind API started")

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/api/prompt")
async def run_prompt(request: PromptRequest, background_tasks: BackgroundTasks):
    # Dynamic import to avoid circular dependency
    from backend.execution.agent_simulator import simulate_agent_swarm
    
    print(f"Received prompt: {request.prompt}")
    background_tasks.add_task(simulate_agent_swarm, request.prompt)
    return {"status": "success", "message": "Swarm dispatched"}

@app.get("/api/rag/search")
async def search_memory(query: str, n: Optional[int] = 5):
    try:
        results = semantic_search(query, n_results=n)
        return {"status": "success", "data": results}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/graph")
async def get_graph():
    from backend.db.mongo_manager import get_nodes_collection, get_edges_collection
    try:
        nodes = await get_nodes_collection().find().to_list(1000)
        edges = await get_edges_collection().find().to_list(1000)
        
        # Format for React Flow
        rf_nodes = []
        for n in nodes:
            rf_nodes.append({
                "id": str(n.get("id", n["_id"])),
                "type": "custom",
                "data": {
                    "label": str(n.get("id", n["_id"])), 
                    "owner": n.get("owner", "Unknown"),
                    "content": n.get("content", "")
                },
                "position": {"x": 0, "y": 0}
            })
            
        rf_edges = []
        for e in edges:
            rf_edges.append({
                "id": str(e.get("id", e["_id"])),
                "source": str(e.get("source", e.get("source_id"))),
                "target": str(e.get("target", e.get("target_id"))),
                "animated": True
            })
            
        return {"nodes": rf_nodes, "edges": rf_edges}
    except Exception as e:
        return {"error": str(e)}

# Serve Next.js static files if they exist (local built dev environment)
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "out")
if os.path.exists(frontend_dir) and os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
