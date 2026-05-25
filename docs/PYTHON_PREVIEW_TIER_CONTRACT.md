# Python Preview-Tier Contract

## Purpose

This contract defines a two-tier result model for Guardr safety checks. The Python FastAPI service at `scripts/guardr_python_api.py` (port 5001) is the **fast preview tier**: it returns immediate, best-effort findings so the UI has something to render within sub-second timeframes. The Rust API at `src/` (binary `guardr-api`, port 5000, routes mounted at `/v1/...`) is the **authoritative tier**: it runs the PERA (Plan-Execute-Review-Adjust) OSINT investigation cycle in `src/ai/investigation.rs`, which can take 60–120 seconds, and produces the final risk verdict. The Python preview is **not** a replacement for the Rust authoritative result — it is a disposable, short-lived placeholder. The governing product principle is: **Rust always overrides Python.** Once the Rust authoritative response arrives, the Python preview is discarded entirely.

This document is a forward-looking contract. The preview-tier seam is described here so a future epic can wire it into the frontend. No code changes are introduced by this document.

## Tier Responsibilities

### Python (fast tier) owns:

- Username/socials presence sweep across the platforms already implemented in `scripts/guardr_python_api.py` (see the `PLATFORMS` constant and the `search_username_osint` function):
  - Instagram (`https://www.instagram.com/{username}/`)
  - GitHub (`https://github.com/{username}`)
  - Reddit (`https://www.reddit.com/user/{username}/`)
  - Spotify (`https://open.spotify.com/user/{username}`)
  - Tinder (`https://tinder.com/@{username}`)
- Any OSINT step the Rust PERA cycle has not yet started or completed — Python provides best-effort early findings to be later refined or replaced by Rust. In practice, today this is the username sweep; the Python service may also opportunistically call HIBP (`scripts/guardr_python_api.py` already does this when `HIBP_API_KEY` is set) and produce a Gemini-driven narrative, but these fields are explicitly preview-grade and are overwritten as soon as Rust's authoritative response is available.

### Rust (authoritative tier) owns:

- Everything else — i.e., the full set of OSINT modules under `src/osint/`:
  - `hibp.rs` (Have I Been Pwned breach lookup)
  - `breach_directory.rs` (BreachDirectory secondary breach corpus)
  - `shodan.rs` (Shodan host intelligence)
  - `facecheck.rs` (FaceCheck reverse image search)
  - `reality_defender.rs` (Reality Defender deepfake / synthetic media detection)
  - `dns_lookup.rs` (DNS lookup on email domains)
  - `ip_lookup.rs` (IP geolocation / reputation)
  - `username_search.rs` (Rust-side username sweep — the canonical version)
- The final risk assessment produced by `src/ai/risk_analyzer.rs` and orchestrated by `src/ai/investigation.rs` (the PERA cycle).
- The complete investigation report, persisted via the report endpoints in `src/api/reports.rs` and surfaced through the dating-safety handlers in `src/api/dating.rs` (`analyze_conversation`, `verify_identity_claims`, `generate_safety_report`) and the security handlers in `src/api/security.rs` (`check_password_strength`, `check_breach`, `calculate_risk_score`, `bulk_security_check`, `filter_data`).

## Endpoint

- **URL**: `POST /v1/preview/check` (proposed — note this is a forward-looking endpoint that does not exist yet; today's Python service exposes `POST /check` (also aliased at `POST /api/check`) and `POST /v1/dating/analyze-conversation` (also aliased at `POST /api/v1/dating/analyze-conversation`) instead).
- **Service host**: TBD (could be co-located with the Rust API, fronted by the same ingress at `/api/preview/*`, or run as a separate sidecar — decision deferred to the wiring epic). Today the Python service binds `0.0.0.0:5001` directly and is unfronted.
- **Authentication**: TBD (most likely the same JWT bearer token used by the Rust API via `crate::auth::AuthenticatedUser`, decision deferred). The current Python service performs no authentication.

## Request Schema

A JSON object with the following fields. The source of truth is the `DemoCheckRequest` Pydantic model in `scripts/guardr_python_api.py`:

- `name`: string, **required**
- `location`: string, optional, default `"Unknown"`
- `email`: string, optional
- `username`: string, optional
- `image_url`: string, optional
- `messages`: array of strings, optional

Example:

```json
{
  "name": "Jordan Rivers",
  "location": "Brooklyn, NY",
  "email": "jordan.rivers@example.com",
  "username": "jordanrivers",
  "image_url": "https://example.com/profile.jpg",
  "messages": [
    "Hey, you free tonight?",
    "I feel like I've known you forever"
  ]
}
```

## Response Schema

A JSON object that mirrors the actual response shape of `POST /check` in `scripts/guardr_python_api.py`, with two preview-tier additions (`preview` and `supersedes_in_ms`):

- `name`: string
- `preview`: literal `true` — discriminator that distinguishes a preview response from an authoritative Rust response
- `risk_level`: `"LOW"` | `"MEDIUM"` | `"HIGH"`
- `risk_score`: integer 0–100
- `person_verification`: string (narrative)
- `username_verification`: array of `{ platform, url, found, status_code }` objects (shape produced by `check_platform` in `scripts/guardr_python_api.py`)
- `recommendations`: array of strings
- `safety_tips`: array of `{ category, message }` objects
- `generated_at`: ISO 8601 timestamp
- `supersedes_in_ms`: optional integer — estimated time until the authoritative Rust result is expected (advisory only; the UI may use it to display a progress hint but MUST NOT block on it)

Example:

```json
{
  "name": "Jordan Rivers",
  "preview": true,
  "risk_level": "MEDIUM",
  "risk_score": 47,
  "person_verification": "Fierce checks completed, darling! Checked 5 platform templates and breach sources. Found footprint on GitHub, Reddit. Breach status: 1 records identified.",
  "username_verification": [
    { "platform": "Instagram", "url": "https://www.instagram.com/jordanrivers/", "found": false, "status_code": 404 },
    { "platform": "GitHub",    "url": "https://github.com/jordanrivers",          "found": true,  "status_code": 200 },
    { "platform": "Reddit",    "url": "https://www.reddit.com/user/jordanrivers/", "found": true,  "status_code": 200 },
    { "platform": "Spotify",   "url": "https://open.spotify.com/user/jordanrivers", "found": false, "status_code": 404 },
    { "platform": "Tinder",    "url": "https://tinder.com/@jordanrivers",          "found": false, "status_code": 404 }
  ],
  "recommendations": [
    "Verify identity with a quick video call before meeting in person.",
    "Keep dating communications on the official application channel.",
    "Always choose a public, crowded spot for first dates."
  ],
  "safety_tips": [
    { "category": "Smart Habits",   "message": "Always meet in public places for first dates." },
    { "category": "Pride Safety",   "message": "LGBTQ+ daters face higher harassment rates—verify first, darling!" },
    { "category": "Zero Knowledge", "message": "Your tokens and searches are never stored on our database." }
  ],
  "generated_at": "2026-05-25T17:42:11Z",
  "supersedes_in_ms": 90000
}
```

## Override / Merge Semantics

These rules are explicit and binding:

1. **Rust authoritative results ALWAYS override Python preview results once available.** There is no field-level merge — the Rust response replaces the preview entirely. The UI MUST NOT attempt to reconcile differences on a per-field basis.
2. **When both responses are available, the UI MUST display the Rust response and discard the preview.** The Python preview is short-lived and disposable; there is no use case for showing both simultaneously once Rust has returned.
3. **If the Rust response fails or times out beyond the configured ceiling (suggested 120 s, matching the upper bound of the PERA cycle runtime in `src/ai/investigation.rs`), the UI MAY continue to show the Python preview with a clear "preview only" indicator.** This is a UX policy decision deferred to the wiring epic, but the contract permits it.
4. **If Python and Rust disagree on a field that exists in both (for example `risk_level`), Rust wins.** Always. No exceptions. This includes cases where Python's heuristic risk score is more conservative than Rust's evidence-backed score.
5. **The Python preview MUST include `preview: true`. The Rust authoritative response MUST NOT include `preview: true`** (or MUST set it to `false` if the field is present at all). This boolean is the discriminator the UI uses to decide whether the displayed result is replaceable.

## Non-Functional Expectations

- **Latency target for Python preview**: under 1500 ms p95. **Caveat**: the existing username sweep in `scripts/guardr_python_api.py` uses a 5.0-second per-platform timeout (see `check_platform` and the `timeout=5.0` argument to `httpx.AsyncClient.get`). With 5 platforms checked in parallel via `asyncio.gather`, the worst-case latency is bounded by the slowest single platform — but a single hung platform can blow the 1500 ms budget. A follow-up may need to tighten per-platform timeouts (e.g., to 1.0 s) so the aggregate p95 stays under 1500 ms.
- **Concurrency**: the Python service is stateless (no per-request server state beyond an `httpx.AsyncClient`). It is safe to scale horizontally behind a round-robin or random load balancer.
- **Failure mode**: if the Python preview fails entirely (timeout, 5xx, network error), the UI MUST proceed straight to the Rust authoritative result with no preview shown. **Failure of the preview must NEVER block the authoritative path.** The Rust investigation is the contract-critical work; Python preview is a latency-hiding optimization on top of it.
- **Rate limiting**: TBD per platform (deferred — `scripts/guardr_python_api.py` has no rate limiting today, neither inbound nor outbound to the social platforms it sweeps).

## What This Contract Does NOT Cover (Deferred)

- Frontend wiring — which component issues the Python call vs. the Rust call, and how it swaps the displayed result when Rust returns.
- Deployment topology — sidecar vs. separate service vs. same container vs. unified ingress.
- Authentication mechanism for the Python service (JWT pass-through, mTLS, shared secret, or unauthenticated behind a trusted ingress).
- Per-platform rate limiting and quotas (both inbound to the preview service and outbound to Instagram/GitHub/Reddit/Spotify/Tinder).
- WebSocket / SSE streaming as an alternative to the two-call request/response pattern (i.e., a single connection that emits a preview frame followed by an authoritative frame).
- Caching of preview results (whether the same `(name, email, username)` tuple should return a cached preview on a second call within a short TTL).

## Source of Truth Files

- Python preview service implementation: `scripts/guardr_python_api.py`
- Rust authoritative endpoints: `src/api/dating.rs`, `src/api/security.rs`, `src/api/reports.rs`
- Rust OSINT modules: `src/osint/breach_directory.rs`, `src/osint/dns_lookup.rs`, `src/osint/facecheck.rs`, `src/osint/hibp.rs`, `src/osint/ip_lookup.rs`, `src/osint/reality_defender.rs`, `src/osint/shodan.rs`, `src/osint/username_search.rs`
- Rust AI / PERA cycle: `src/ai/investigation.rs`, `src/ai/risk_analyzer.rs`
