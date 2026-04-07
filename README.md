# NodeMind

> **Graph Memory for Multi-Agent AI Systems.**
> Replace the linear context window with a persistent, semantic knowledge graph — shared across every agent in your swarm.

---

## The Problem with Multi-Agent Memory

Every major multi-agent framework — LangChain, AutoGen, CrewAI — hits the same wall.

When you spin up a swarm of agents, each one operates inside its own **isolated, linear context window**. The Project Manager writes a spec. The Frontend Engineer writes components. The Backend Engineer writes APIs. But none of them have any real awareness of what the others are doing — unless you staple every previous message into the next prompt.

This creates two compounding problems:

**1. The Black Box Problem**
Your Backend Engineer is writing an API schema without knowing what data structures the Frontend Engineer needs. Your QA Tester is writing test cases without knowing what edge cases the Backend already handled. Each agent is working in a **black box**, guessing at context it can't see.

**2. The Token Explosion Problem**
The standard fix is to inject prior agent outputs as context into every subsequent call. Works for 2 agents. At 5 agents across 10 rounds, you're sending **every prior conversation** in every prompt. Token costs scale quadratically. At some point, you hit the context limit and the system breaks entirely.

---

## NodeMind's Solution: Graph Memory

NodeMind replaces the flat, repeating context dump with a **persistent knowledge graph**.

Each agent writes **atomic Markdown notes** as it works — small, focused files that capture a single decision, design choice, or architectural insight. These notes are stored locally in `.brain/`, embedded into a vector database (ChromaDB), indexed in MongoDB, and immediately visible to every other agent in the swarm via **semantic search**.

When a new agent starts work, instead of receiving a massive dump of prior conversation history, it receives only the **most semantically relevant notes** from the graph — retrieved via vector similarity, not recency. The Frontend Engineer gets context about the API contract the Backend defined. The QA Tester finds the edge case the PM flagged. Each agent navigates the graph, not a transcript.

The result:
- **Token usage stays bounded.** The graph grows, but each agent query only loads the relevant slice.
- **Context improves over time.** As more notes accumulate, the semantic search gets more precise, not noisier.
- **Agents are no longer black boxes.** Every decision is a node in the graph, visible to everyone.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         NodeMind Stack                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│   │   Browser   │    │  FastAPI     │    │  Agent Swarm     │   │
│   │  React Flow │◄───│  WebSocket   │◄───│  (Gemini 2.5)    │   │
│   │  Visualizer │    │  :8000       │    │  4 Agents        │   │
│   └─────────────┘    └──────────────┘    └──────────────────┘   │
│          │                  │                      │             │
│          │            ┌─────▼──────┐         ┌────▼────────┐    │
│          │            │  MongoDB   │         │  .brain/    │    │
│          │            │  (Nodes +  │         │  session_*/ │    │
│          │            │   Edges)   │         │  *.md files │    │
│          │            └─────┬──────┘         └────┬────────┘    │
│          │                  │                      │             │
│          │            ┌─────▼──────────────────────▼────────┐   │
│          └────────────│         ChromaDB (Vector Store)      │   │
│                       │     Semantic Similarity Engine        │   │
│                       └──────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Agent Swarm Pipeline

```
User Prompt
    │
    ▼
┌─────────────────┐
│ Project Manager │  → Breaks prompt into 3-4 scoped architecture notes
└────────┬────────┘
         │ (semantic context passed forward)
    ▼
┌─────────────────────┐
│ Frontend Engineer   │  → Writes 3-4 UI/UX component notes
└────────┬────────────┘
         │ (semantic context from PM + prior nodes)
    ▼
┌─────────────────────┐
│ Backend Engineer    │  → Writes 3-4 API/DB/infra notes
└────────┬────────────┘
         │ (semantic context from all prior nodes)
    ▼
┌────────────────┐
│ QA Tester      │  → Writes 3-4 test case / edge case notes
└────────┬───────┘
         │
    ▼
[ Semantic Pass ]  → ChromaDB indexes all ~12-16 nodes
                     Cross-owner edges computed (max 3 per node)
                     Animated edges broadcast to React Flow canvas
```

---

## Features

### 🧠 Graph Memory
- Every agent output is atomized into individual Markdown notes stored in `.brain/session_*/`
- Notes are embedded into ChromaDB as dense vector representations
- All nodes and edges persisted in MongoDB
- Each session gets an isolated timestamped directory — no cross-session contamination

### 🔗 Semantic Neural Linking
- After all nodes are created, a **post-swarm semantic pass** runs across every node in the session
- ChromaDB finds the top semantic matches for each node across **all agents** (not just its own category)
- Edges are built **exclusively between different agent owners** — enforcing cross-discipline semantic connections
- Maximum 3 edges per node to keep the graph sparse and meaningful, not cluttered

### 📊 Real-Time React Flow Visualizer
- **4 strict swimlane columns**, one per agent owner (PM / Frontend / Backend / QA)
- Nodes appear in their owner column as agents generate them — no layout engine, no physics
- Semantic edges animate in **after all nodes are placed**, so you see: grid first → connections second
- `fitView` auto-zooms to fit every new node added
- Click any node to open a **Markdown Drawer** with the full note content

### 🖥️ Hacker Terminal Feed
- macOS-style terminal UI in the top-right corner
- Color-coded log lines: `+` green for node creation, `~` cyan for semantic linking, `✗` red for errors
- Live status pill tracks each pipeline phase: `⚡ Initiating` → `🧠 PM thinking` → `🕸️ Semantic search` → `🔗 Linking` → `✅ Done`
- Auto-scrolls to the latest log in real time

### 📡 WebSocket Real-Time Pipeline
- FastAPI backend streams events to the frontend via WebSocket
- Two distinct event types:
  - `addNode` — fired immediately when a node is written, places it in the correct column
  - `semanticLink` — fired once after the full swarm completes, wires the cross-owner edges
- `log` events stream status and progress messages to the terminal feed

### 🗂️ Session Isolation
- Each user prompt creates a new timestamped `.brain/session_YYYYMMDD_HHMMSS/` directory
- Frontend canvas clears on every new prompt submission
- Canvas column counters reset so nodes always stack cleanly from the top

### 📐 Atomic Note Structure
Each agent note follows a consistent Frontmatter + Markdown schema:

```markdown
---
owner: Frontend Engineer
---
# Component: Mapbox Live Tracking Layer

The primary map view renders driver positions in real time using Mapbox GL JS...
[[Backend_WebSocket_Server]]
```

Owner metadata drives column placement. `[[Wiki-links]]` allow explicit cross-references (filtered to cross-owner only).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Agent LLM | Google Gemini 2.5 Flash (Structured JSON Outputs) |
| Backend API | FastAPI + Uvicorn |
| WebSockets | FastAPI WebSocket + custom broadcast manager |
| Vector DB | ChromaDB (local persistent) |
| Document DB | MongoDB (via Motor async driver) |
| Frontend | Next.js 14 (App Router) |
| Graph UI | React Flow (`@xyflow/react`) |
| Terminal UI | Custom hacker-theme panel (no library) |
| File Watching | Watchdog |
| CLI | Click + Rich + Textual (TUI) |

---

## Local Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- MongoDB running locally (`mongod`) or a MongoDB Atlas URI
- A Google Gemini API key

### 1. Clone the repository

```bash
git clone https://github.com/your-username/NodeMind.git
cd NodeMind
```

### 2. Set up the Python backend

```bash
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -e .
```

### 3. Initialize and Configure

NodeMind features an interactive setup wizard. Run the following command to initialize your workspace and configure your API keys:

```bash
nodemind init
```

The wizard will safely prompt you for:
- **MongoDB Connection URL**: (Defaults to `mongodb://localhost:27017`)
- **Gemini API Key**: Securely hidden during input.

Your settings will be saved to a `.env` file in your current directory.

### 4. Start MongoDB (if not using remote)

If you are using a local MongoDB instance, ensure it is running:
```bash
# macOS with Homebrew
brew services start mongodb-community
# Windows
# Ensure 'mongod' is running or MongoDB service is started
```

### 5. Install the frontend

```bash
cd frontend
npm install
cd ..
```

### 6. Start NodeMind

In **Terminal 1** — start the backend daemon:

```bash
nodemind start
```

In **Terminal 2** — start the frontend:

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Installation via pip

NodeMind is a production-ready CLI package. To install it globally on your system:

```bash
pip install "git+https://github.com/gummybearansh/NodeMind.git"
nodemind init
nodemind start
```

No clone required for the backend. The CLI handles initializing your environment dynamically.

---

## Installation via curl

One-line setup script for macOS/Linux:

```bash
curl -sSL https://raw.githubusercontent.com/gummybearansh/NodeMind/main/install.sh | bash
```

This will:
1. Check Python requirements
2. Install the `nodemind` CLI via pip
3. Guide you through initialization and starting the frontend

---

## Clean Environment Test (Windows/macOS)

For developer testing in a fresh environment, follow these steps to isolate and verify the installation:

### Windows (PowerShell)
```powershell
cd $HOME\Desktop
mkdir nodemind-test
cd nodemind-test
python -m venv testenv
# Enable script execution for the session
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
# Activate the environment
.\testenv\Scripts\Activate.ps1
# Uninstall any existing versions and install the feature branch
pip uninstall nodemind -y
pip install --no-cache-dir "git+https://github.com/KunalMuk2205/NodeMind.git@feature/cli-onboarding-packaging"
# Run setup (interactive wizard)
nodemind setup
# Start the daemon
nodemind start
```

### macOS / Linux (Zsh/Bash)
```bash
cd ~/Desktop
mkdir nodemind-test
cd nodemind-test
python3 -m venv testenv
source testenv/bin/activate
pip uninstall nodemind -y
pip install --no-cache-dir "git+https://github.com/KunalMuk2205/NodeMind.git@feature/cli-onboarding-packaging"
nodemind setup
nodemind start
```

---

## CLI Usage

The `nodemind` CLI comes with several built-in commands designed for a smooth developer experience:

- `nodemind init` — Bootstraps a new NodeMind workspace in your current directory (creates `.brain/` and a `.env` template).
- `nodemind doctor` — Scans your system to verify all requirements (Python, Node.js, MongoDB ports, and API keys) are configured correctly.
- `nodemind start` — Starts the backend server and the Textual TUI, emitting instructions for launching the frontend.

---

## Usage

### Running a prompt

Type any software architecture task into the input field and hit **Run Swarm**:

```
Build a real-time collaborative whiteboard application.
Design a secure authentication system for a microservices architecture.
Create a product catalog management system for an e-commerce platform.
Architect a local AI-powered email summarization desktop app.
```

The swarm will:
1. **Project Manager** breaks the problem into 3-4 architectural scope notes
2. **Frontend Engineer** writes 3-4 UI/UX component notes
3. **Backend Engineer** writes 3-4 API, database, and infra notes
4. **QA Tester** writes 3-4 edge case and test strategy notes
5. **Semantic pass** runs ChromaDB across all ~12-16 nodes and wires cross-agent edges

### Viewing notes

Click any node on the canvas to open a Markdown Drawer showing the full note content.

### Session files

All notes are saved locally in `.brain/session_YYYYMMDD_HHMMSS/` as plain Markdown files — readable, editable, and version-controllable.

---

## Why This Matters for AI Agent Scaling

As you add more agents to a swarm, the standard approach of passing conversation history breaks down. The graph memory approach scales differently:

| Agents | Standard Token Cost | NodeMind Token Cost |
|--------|--------------------|--------------------|
| 2      | O(n)               | O(k) where k = relevant neighbors |
| 5      | O(n²)              | O(k) |
| 10     | Context limit hit  | O(k) |
| 50     | Impossible         | O(k) |

`k` is bounded by the semantic search result count (e.g. k=3 per query), regardless of how many total nodes exist in the graph. The graph grows; the per-agent query cost stays fixed.

---

## Project Structure

```
NodeMind_Backend/
├── backend/
│   ├── api/
│   │   ├── server.py          # FastAPI routes + WebSocket endpoint
│   │   └── websockets.py      # WebSocket broadcast manager
│   ├── core/
│   │   ├── config.py          # Pydantic settings / .env loading
│   │   └── queue.py           # TUI log queue
│   ├── db/
│   │   ├── chroma_manager.py  # ChromaDB vector operations
│   │   └── mongo_manager.py   # MongoDB async collections
│   ├── execution/
│   │   ├── agent_simulator.py # Swarm orchestration + session management
│   │   └── agents.py          # System prompts for each agent role
│   ├── observer/
│   │   ├── translator.py      # File → MongoDB + ChromaDB + WebSocket
│   │   └── watcher.py         # Watchdog filesystem observer
│   └── tui/
│       └── app.py             # Textual TUI dashboard
├── frontend/
│   └── src/app/
│       ├── page.js            # React Flow visualizer (swimlane layout)
│       ├── globals.css        # Dark mode + glow animations
│       └── components/
│           ├── CustomNode.js  # Owner-colored graph node card
│           └── MarkdownDrawer.js  # Slide-in note viewer
├── .brain/                    # Session note directories (gitignored)
├── chroma_db/                 # ChromaDB vector store (gitignored)
├── .env                       # Secrets (gitignored)
├── .gitignore
├── setup.py
└── README.md
```

---

## Roadmap

- [ ] **pip install / curl installer** — one-command setup
- [ ] **Node click → edit** — edit notes directly from the visualizer
- [ ] **Session history sidebar** — reload and browse past sessions
- [ ] **Exponential backoff** — graceful Gemini rate limit handling
- [ ] **Custom agent roles** — define your own agent archetypes via config
- [ ] **Export** — export the session graph as a PNG, JSON, or Obsidian vault
- [ ] **Multi-model support** — swap Gemini for Claude, GPT-4o, or local Ollama models
- [ ] **Electron wrapper** — ship as a desktop app with bundled MongoDB + ChromaDB

---

## Publishing to PyPI

If you are a maintainer, here is how you publish a new version of `nodemind`:

1. Update the version in `pyproject.toml`.
2. Build the package:
   ```bash
   python -m build
   ```
3. Upload to PyPI using twine:
   ```bash
   python -m twine upload dist/*
   ```

---

## Contributing

Contributions are welcome. Open an issue to discuss major changes before submitting a PR.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push and open a Pull Request

---

## License

MIT © NodeMind Contributors
