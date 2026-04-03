# ⚽ Matcharr

**Matcharr** is a companion service for [Dispatcharr](https://github.com/Dispatcharr/Dispatcharr): it reads ESPN schedules, matches live stream titles to per-league patterns, and updates your team’s virtual Dispatcharr channel to the right stream when a game is in the routing window.

The stack is a **FastAPI** backend (scheduler + SQLite + Dispatcharr client) and a **React** UI (Vite, Tailwind CSS) served as static files in production or proxied in development.

---

## Table of Contents

- [Features](#features)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Quick start (Docker)](#quick-start-docker)
- [First-time configuration](#first-time-configuration)
- [Development](#development)
- [Configuration](#configuration)
- [API and docs](#api-and-docs)
- [Security model](#security-model)
- [Project layout](#project-layout)
- [Contributing](#contributing)
- [AI disclosure](#ai-disclosure)
- [License](#license)

---

## Features

- **League profiles** — Per-sport/league stream name templates with placeholders: `{n}`, `{away}`, `{home}`, `{time}`, `{league}`. Optional stream name filter for Dispatcharr list/search.
- **Team channels** — Map an ESPN team to a Dispatcharr channel ID; the app picks the stream whose title matches the upcoming matchup.
- **Schedules** — Fetches public ESPN scoreboard data from `site.api.espn.com` (no API key).
- **Dispatcharr** — Lists streams and channels, and **PATCH**es channel stream membership to point at the matched stream.
- **Dashboard** — Upcoming games, routing preview, manual run, and switch history.
- **Web UI** — React 19, Vite 8, Tailwind CSS v4.

---

## How it Works

1. You define **league profiles** (ESPN sport/league, pattern, filter).
2. You add **team channels** (ESPN team + Dispatcharr channel for that team’s “virtual” channel).
3. A **background job** refreshes schedules and, when a game is in the configured window, finds a Dispatcharr stream whose title matches the pattern for that matchup and updates the channel.

---

## Requirements

- **Dispatcharr** reachable from Matcharr (same Docker network, LAN, or tunneled URL) with a **JWT access token** or **API key** (Dispatcharr: “Copy API Key” or equivalent).
- **Docker** (optional but recommended for production-like runs), or **Python 3.12+** and **Node.js 22+** (matches the Docker frontend build) for local development.

---

## Quick Start (Docker)

From the repository root:

```bash
docker compose up -d --build
```

Then open **[http://localhost:8400](http://localhost:8400)**.

- **Data** persists under `./data` on the host (mounted to `/app/data` in the container). The SQLite file is created automatically.
- **Timezone** defaults to `America/New_York` in `docker-compose.yml`; adjust the `TZ` value if you prefer another zone.

To rebuild after pulling changes:

```bash
docker compose build --no-cache && docker compose up -d
```

---

## First-Time Configuration

1. **Settings** — Set the Dispatcharr base URL (for example `http://dispatcharr:8000` if Dispatcharr is another container on the same Docker network) and paste your **JWT** or **API key**. Use **Test connection** to verify.
2. **League profiles** — Example: ESPN `baseball` / `mlb`, pattern like `MLB {n} | {away} vs {home} | {time}`, stream filter `MLB` (used when searching Dispatcharr streams).
3. **Team channels** — Choose the team from ESPN helpers in the UI, enter the Dispatcharr **channel ID** for that team’s virtual channel, and link it to the right league profile.

Use **Routing preview** / **Upcoming stream matches** to validate patterns before relying on the scheduler.

---

## Development

### Backend and built UI (single process)

Use this when you want the API and the production-built frontend together (same as Docker behavior, locally):

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
cd frontend && npm install && npm run build && cd ..
MA_DATA_DIR=./data MA_STATIC_DIR=./frontend/dist PYTHONPATH=backend .venv/bin/uvicorn app.main:app --reload --port 8400
```

Open **[http://127.0.0.1:8400](http://127.0.0.1:8400)**.

### Frontend with hot reload

Run the backend (without `MA_STATIC_DIR`, or point it elsewhere) on port **8400**, then:

```bash
cd frontend && npm install && npm run dev
```

The Vite dev server (default **[http://127.0.0.1:5173](http://127.0.0.1:5173)**) proxies `/api` to **[http://127.0.0.1:8400](http://127.0.0.1:8400)** (`vite.config.ts`). Start uvicorn separately, for example:

```bash
MA_DATA_DIR=./data PYTHONPATH=backend .venv/bin/uvicorn app.main:app --reload --port 8400
```

### Tests

Pattern logic tests live under `backend/tests/`. If you use `pytest`, install it in your environment and run from the repo root with `PYTHONPATH` set:

```bash
PYTHONPATH=backend python -m pytest backend/tests -q
```

---

## Configuration

Environment variables use the prefix `**MA_**`. Values are read by the backend via `pydantic-settings`.


| Variable           | Default                                         | Description                                                                                                                                         |
| ------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MA_DATA_DIR`      | `/app/data` (local dev: override e.g. `./data`) | Directory for SQLite and app data. Created if missing.                                                                                              |
| `MA_DATABASE_NAME` | `matcharr.db`                                   | SQLite filename inside `MA_DATA_DIR`.                                                                                                               |
| `MA_STATIC_DIR`    | unset                                           | If set to a directory containing the built UI (`index.html`, `assets/`), FastAPI serves the SPA and static assets. In Docker this is `/app/static`. |


**Listen address and port** — Set these on **uvicorn** (or your process manager), not via the table above. The Docker image runs `uvicorn` with `--host 0.0.0.0` and `--port 8400`. Compose maps host port `8400` to the container by default.

If you still have an existing SQLite file named `streamroutarr.db` from an older install, either rename it to `matcharr.db` or set `MA_DATABASE_NAME=streamroutarr.db`.

---

## API and Docs

- **OpenAPI** — With the server running, interactive docs are at `/docs` (Swagger UI) and `/redoc` on the same origin as the app (for example `http://localhost:8400/docs` when using the default port).
- **REST API** — All application routes are under the `**/api`** prefix (for example `/api/settings`, `/api/dashboard`).

---

## Security Model

Matcharr is aimed at **home or trusted networks**. The HTTP API **does not implement authentication**: anyone who can reach the service can read or change configuration (including Dispatcharr credentials stored in SQLite) and trigger routing behavior.

**Recommended practices:**

- Do not expose the container or process directly to the **public internet** without a reverse proxy, TLS, and your own access controls (for example HTTP basic auth, OAuth2 proxy, or VPN-only access).
- Prefer binding to **localhost** or a private interface, and use **firewall rules** where appropriate.
- Treat the SQLite database under `MA_DATA_DIR` as **sensitive**; it contains app settings and operational data.

---

## Project layout

```text
├── backend/           # FastAPI application (use PYTHONPATH=backend)
├── frontend/          # React + Vite UI
├── docker-compose.yml # Production-style run with volume for ./data
├── Dockerfile         # Multi-stage: build UI, copy into Python image
├── LICENSE            # MIT
├── AI_DISCLOSURE.md   # How AI tools may have been used in this project
└── README.md
```

---

## Contributing

Issues and pull requests are welcome. For larger changes, opening an issue first helps align on direction. Please keep commits focused and match existing code style.

---

## AI Disclosure

This project includes material produced or edited with **AI-assisted coding tools**. That does not change the license, but it matters for transparency. See **[AI_DISCLOSURE.md](AI_DISCLOSURE.md)** for details.

---

## License

[MIT](LICENSE)