# Backend (Part 2): LLM labeling and photo checks

A FastAPI service that holds the Claude API key. It labels study-session activity against the user's task and checks paper-session photos. Every LLM output is validated, retried up to 2 times with the validator's errors, and falls back to "unclear" or partial credit. Stats are computed by code. Formats: [docs/contracts.md](../docs/contracts.md).

## Setup (Python 3.9+)

```sh
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/python -m pytest -q
```

## Run locally

```sh
export ANTHROPIC_API_KEY=sk-ant-...      # never commit this
export FLORA_SHARED_SECRET=pick-a-long-random-string
.venv/bin/uvicorn app.server:app --reload --port 8000
```

Interactive API docs are at http://127.0.0.1:8000/docs. Optional env vars: `FLORA_MODEL` (default `claude-haiku-5-5`) and `FLORA_EFFORT` (default `medium`).

## Accuracy eval (uses API credits)

```sh
PYTHONPATH=. .venv/bin/python ../eval/run_eval.py
```

## Layout

| File | What it does |
|---|---|
| `app/contracts.py` | Pydantic models for every request, response and LLM output |
| `app/labeling.py` | Rules (idle, allowlist and blocklist), the LLM retry loop, the confidence threshold |
| `app/stats.py` | On-task minutes, %, longest streak |
| `app/photo.py` | Code-word match and partial credit |
| `app/claude.py` | The only code that calls Claude (prompts and JSON schemas) |
| `app/main.py` | FastAPI routes and the shared-secret check |
| `app/server.py` | Production entry point that reads env vars |
