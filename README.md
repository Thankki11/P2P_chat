# P2P Chat System

A peer-to-peer chat application built with Python (FastAPI + TCP sockets) and React + Vite + Tailwind CSS.

---

## Requirements

- Python 3.10+
- Node.js 18+
- npm 9+

---

## Installation

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

---

## How to Run

### 1. Start the Bootstrap Server (port 9000)

```bash
cd backend
python bootstrap_server.py
```

### 2. Start a Peer Node + REST API Bridge (port 8000)

```bash
cd backend
python peer_node.py --username alice --port 6001 --bootstrap localhost:9000
python api_bridge.py
```

### 3. Start the Frontend Dev Server (port 5173)

```bash
cd frontend
npm run dev
```

---

## Run Tests

```bash
cd backend
pytest tests/ -v
```
