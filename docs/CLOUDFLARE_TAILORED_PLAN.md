# Guardr Cloudflare Tailored Plan

## Position

Do not try to stuff the current service into Cloudflare Workers as-is. The current API is a server-oriented Rust/Axum application with process state, SQLx SQLite pooling, Redis client initialization, filesystem-backed migrations, and long-running OSINT calls. Those assumptions fit a container or VM. They do not map cleanly to an edge runtime.

The right Cloudflare plan is a product/architecture split:

- Put the website and edge-facing public endpoints on Cloudflare.
- Keep the existing Rust API on normal server compute while it is stabilized.
- Rewrite only the small API surface that benefits from Cloudflare-native primitives.
- Keep public checks stateless by default. Guardr should process inputs transiently, return guidance, and discard user-submitted identity data.

## Current System

Guardr has three distinct surfaces:

1. **Marketing website**
   - Next.js app in `website/`.
   - Mostly static pages today.
   - Good fit for Cloudflare Pages.

2. **Public safety check**
   - `POST /check` in `src/api/mod.rs`.
   - Runs the PERA investigation cycle.
   - Calls external OSINT and AI services.
   - Potentially slow and dependency-heavy.
   - Must not persist submitted names, emails, usernames, photos, image URLs, messages, locations, or raw provider results.

3. **Authenticated API**
   - `/v1/auth/*`, `/v1/user/*`, `/v1/security/*`, `/v1/dating/*`, `/v1/reports/*`.
   - Uses SQLite through SQLx.
   - Uses Redis client setup in `AppState::new()`.
   - Uses JWT, bcrypt, usage tracking, security report persistence, and admin report endpoints.
   - These account/report features should be treated as legacy or future opt-in surfaces, not the default public product.

## Privacy Product Rule

Guardr is a transient safety check, not an investigation dossier.

Default behavior:

- Process submitted data in memory.
- Return a risk level, confidence, short reasoning summary, and safety guidance.
- Store no submitted identity data.
- Store no uploaded photos, image URLs, messages, names, locations, emails, usernames, face embeddings, biometric templates, or raw OSINT responses.
- Log only operational metadata: endpoint, status, latency, provider success/failure, and coarse risk bucket.
- Let users save or screenshot results on their own device if they want a record.

Any saved-report feature must be a separate, explicit, authenticated opt-in product. It is not part of the first working service.

## Recommended Target Architecture

### Cloudflare Pages

Host the website on Cloudflare Pages. Build from `website/`, with the public API URL set to the chosen API gateway route.

This is the lowest-risk move and gives Guardr control of `guardr.app` at the edge without changing backend semantics.

### Cloudflare Worker API Gateway

Add a small Worker in front of the API. Its job is not to replace the Rust API yet. Its job is to make routing, CORS, rate limiting, basic request validation, and future cutovers explicit.

Initial Worker responsibilities:

- Serve `/api/check` as the public entrypoint.
- Proxy to the existing Rust backend for endpoints that are not Cloudflare-native yet.
- Add a consistent timeout/error envelope for slow OSINT calls.
- Keep origin URLs out of the frontend.
- Avoid logging request bodies or user-submitted identity fields.
- Make future endpoint-by-endpoint migration possible.

### Existing Rust API

Keep the Rust API on server compute for now. Cloudflare options here are:

- Keep it on DigitalOcean temporarily behind a Worker.
- Move it to a container host later if DigitalOcean is not the desired long-term platform.
- Avoid rewriting the entire Axum app until the public product surface is clearer.

The current Rust service should be stabilized first:

- Fix the `UserSubscriptionTier` SQL serialization mismatch.
- Make Redis optional or replace its use where it is not essential.
- Normalize route docs so they match the real mounted paths.
- Add smoke tests around `/health`, `/check`, registration, and login.

### D1

D1 is not required for the first public safety check. Avoid putting user-submitted check content in D1.

Possible future D1 use:

- Account data only if authenticated features return.
- Aggregated operational metrics that do not identify users.
- Explicit opt-in saved reports, if the product ever adds them.

Do not treat D1 as a transparent `sqlite_url` replacement for SQLx, and do not migrate the existing report tables until the privacy model for saved data is intentionally designed.

### KV

Use KV for low-sensitivity, eventually consistent data:

- Feature flags.
- Public config.
- Cached OSINT metadata with short TTLs.
- Rate-limit markers only if exact consistency is not required.

Do not put user secrets, password hashes, submitted identity fields, or detailed safety reports in KV.

### R2

Avoid R2 for user-submitted check inputs in the first version.

Use R2 only if Guardr later needs explicit opt-in file/object storage:

- Uploaded images for face/reality checks.
- Exported report archives.
- Debug artifacts that should not live in the database.

Raw user photos should not be stored by default.

### Queues

Use Queues for slow or retryable OSINT work:

- Deep investigation jobs.
- External API retries.
- Email or alert delivery later, if those features become explicit opt-in products.

This is the right answer for operations that do not need to block the request/response path, but queued payloads must also respect the transient-data rule.

## Phased Plan

### Phase 0: Stabilize What Exists

Goal: make the current production behavior reliable before moving pieces.

Tasks:

- Fix the auth enum bug in `src/database.rs`.
- Confirm local startup with `DATABASE_URL="sqlite:./data/guardr.db?mode=rwc"` and Redis running.
- Add a minimal smoke test script for `/health` and `/check`.
- Remove raw identifiers from logs and public-check findings where they are not needed for the response.
- Document which endpoints are public, authenticated, admin-only, and legacy/deferred.

Exit criteria:

- Local Rust API starts cleanly.
- Public check endpoint returns a real response with missing API keys gracefully degraded.
- Public check performs no database writes and logs no submitted identity values.
- Registration/login and saved reports are explicitly deferred from the public launch unless needed.

### Phase 1: Cloudflare Front Door

Goal: put Cloudflare in control of traffic without rewriting the application.

Tasks:

- Deploy the website to Cloudflare Pages.
- Create a small Worker API gateway for `/api/*`.
- Proxy `/api/check` to the existing Rust API.
- Add CORS handling for `guardr.app` and local development.
- Add basic request size limits and structured error responses.
- Keep secrets in Cloudflare bindings/secrets, not source files.

Exit criteria:

- `https://guardr.app` serves the site from Cloudflare.
- `https://guardr.app/api/check` reaches the Rust backend through the Worker.
- The frontend no longer needs the DigitalOcean URL at build time.

### Phase 2: Cloudflare-Native Public Check

Goal: move only the public safety-check path toward Cloudflare-native pieces.

Tasks:

- Extract the `/check` request/response contract into a small shared spec.
- Implement lightweight Worker validation and request normalization.
- Move slow investigation work to a background job where user experience allows it, without persisting identity data beyond processing.
- Keep external OSINT integrations modular so failures degrade cleanly.

Exit criteria:

- The public check flow can survive slow external APIs.
- User-facing responses are consistent.
- Investigation work has observable status and retry behavior without storing submitted identity details.

### Phase 3: Authenticated Product API

Goal: migrate or retire authenticated endpoints only after the product contract is stable.

Tasks:

- Decide whether auth remains in Rust or moves to a Worker.
- If moving auth, reimplement password hashing and JWT validation deliberately.
- Remove or defer saved reports/history unless there is a clear opt-in product requirement.
- Port one endpoint family at a time only if it still supports the privacy-first product.
- Use D1 migrations and seed scripts rather than SQLx compile-time migrations.
- Keep old and new APIs behind the Worker gateway during transition.

Exit criteria:

- Each migrated endpoint has a compatibility test against the old behavior.
- Data writes go to one canonical store.
- Rollback path is clear.
- No endpoint stores user-submitted identity data without explicit opt-in.

### Phase 4: Retire Server Runtime Where It Makes Sense

Goal: remove the old server only if the remaining workload is truly Cloudflare-native.

Keep server compute if Guardr still needs:

- Long-running synchronous OSINT operations.
- Native Rust crates that do not fit Workers.
- Process-level services.
- Runtime SQLite pooling via SQLx.
- Heavy scraping or browser automation.

Retire server compute only after:

- Public and authenticated API flows are migrated.
- Background jobs are running through Queues/Workers.
- Persistent data needs are either removed or intentionally assigned to D1/R2/KV.
- Observability and rollback are in place.

## Non-Goals

- Do not compile the current Axum API into a Worker.
- Do not treat D1 as a transparent `sqlite_url` replacement for SQLx.
- Do not move every endpoint at once.
- Do not make accounts, saved reports, or dashboards part of the first public service.
- Do not store sensitive user investigation data in KV, D1, R2, logs, or queues by default.

## Immediate Next Work

1. Fix the auth enum mismatch in `src/database.rs`.
2. Remove raw user identifiers from `/check` logs and findings.
3. Add a smoke test for `/health` and stateless `/check`.
4. Add a small Cloudflare Worker gateway skeleton.
5. Defer Cloudflare Pages and UI work until the stateless service path is proven.
