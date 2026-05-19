---
title: The Red Room API
emoji: 📝
colorFrom: red
colorTo: pink
sdk: docker
app_port: 7860
pinned: false
short_description: Pre-publication review API for The Red Room
---

# The Red Room — backend

FastAPI service that powers the multi-agent pre-publication review at
**The Red Room** (https://github.com/akshaj/red-room).

This is the backend only. It exposes:

- `GET /health` — liveness probe
- `POST /critique` — non-streaming review
- `POST /critique/stream` — server-sent events stream of agent critiques

The frontend lives separately (Vercel, Next.js) and points its
`NEXT_PUBLIC_BACKEND_URL` at this Space.

## Required secrets

Set these in **Settings → Variables and secrets**, as **secrets** (not
plain variables):

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `RED_ROOM_CORS_ORIGINS` | The frontend's full URL (e.g. `https://red-room.vercel.app`). No trailing slash. Comma-separated for multiple. |

## How it runs

The Dockerfile installs the package, then runs:

```
uvicorn red_room.api:app --host 0.0.0.0 --port 7860
```

The Space sleeps after ~30 minutes idle on the free tier and wakes on the
next request (a cold start can take ~30 seconds).
