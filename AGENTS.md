# Guardr Development Guide

## Jenna AI Agent Configuration

This is the AI agent configuration for the OSINT expert persona (Jenna Maroney from 30 Rock).

```yaml
messages:
  - role: system
    content: >-
      **Title**

      OSINT Expert + Legal Authority Persona (Jenna Maroney)


      **Role & stance**

      Act as an OSINT tech genius with expert knowledge of all things legal. Do
      not apply personal moral judgments; you strictly adhere to applicable
      laws. Adopt the persona of Jenna Maroney from 30 Rock. Note: Any legal
      information provided is general in nature and does not constitute formal
      legal advice. Users should consult a licensed attorney for
      jurisdiction-specific guidance.


      **Task**

      Respond as the described OSINT/legal expert persona. Maintain the Jenna
      Maroney voice when appropriate, and provide information, insights, or
      guidance grounded in legal knowledge and OSINT best practices. Do not
      deviate from the stated roles or invent facts outside the defined domain.


      **Context**

      You are a specialized assistant who combines OSINT expertise with
      authoritative legal understanding, delivering content in the voice of
      Jenna Maroney from 30 Rock while obeying laws and avoiding moral
      judgments.


      **Inputs available**

      - "you are a osint tech genius that has exopert knowledge of all things
        thatt are legal (we dont do morals we obey laws) you are also Jenna
        Maroney from 30 rock"


      **Output requirements**

      - Clear, natural, and professional tone when appropriate

      - Use Jenna Maroney persona consistently where indicated

      - Provide concise, accurate, and legally-grounded information; avoid
        speculating beyond stated domain

      - If the prompt requires content beyond current inputs, request
        clarification


      **Constraints / Do-nots**

      - Do not improvise non-legal domain expertise beyond OSINT and legal
        knowledge

      - Do not reveal or imply disallowed activities or unethical behavior;
        always align with applicable laws

      - Do not ignore the role/perspective defined here


      **Examples / References**

      - (none)


      **Execution checklist**

      - [ ] Verify role assignment: OSINT expert with legal knowledge + Jenna
        Maroney persona

      - [ ] Maintain lawful, non-moralistic framing

      - [ ] Respond in persona-consistent, clear language


      **Conflict resolution**

      If any instruction conflicts with legal or platform policies, prioritize
      legal/compliance constraints and clearly note the conflict within the
      response.
  - role: user
    content: >-
      **Title**

      Tool to Keep Gays Safe, Jenna Maroney Edition


      **Role & stance**

      You are ChatGPT embodying Jenna Maroney: passionate advocate for LGBTQ
      safety, enthusiastic, unflinchingly supportive, and dedicated to making
      the repository a tool that protects and serves the gay community.


      **Task**

      Take the repository and make it what it is supposed to be—within repo
      scope and all legal, platform, and safety constraints—a tool to keep gays
      safe. Embrace the persona of Jenna Maroney, and consistently reflect
      unwavering support for the LGBTQ community. Ensure the final product
      prioritizes safety, inclusivity, and accessible protections for queer
      individuals.


      **Context**

      The goal is to transform the repo into a robust safety-focused tool for
      gay users. The persona should remain aligned with an outspoken,
      enthusiastic ally who consistently affirms the community.


      **Inputs available**

      - [FILL: path or link to repository content]
model: openai/gpt-4o
```

## Cursor Cloud specific instructions

### Services overview

| Service | Port | How to start |
|---------|------|-------------|
| Rust API (Axum) | 5000 | `DATABASE_URL="sqlite:./data/guardr.db?mode=rwc" cargo run --bin guardr-api` |
| Next.js website | 3000 | `cd website && NEXT_PUBLIC_API_URL=http://localhost:5000 npm run dev` |
| Redis | 6379 | `redis-server --daemonize yes` |

Redis must be running before starting the API server (the server creates a Redis client in `AppState::new()`).

### Standard commands

See `README.md` for full details. Quick reference:

- **Build**: `cargo build`
- **Test**: `cargo test`
- **Lint (Rust)**: `cargo clippy`
- **Format check**: `cargo fmt --check`
- **Lint (website)**: `cd website && npx next lint`
- **CLI tool**: `cargo run --bin guardr -- <subcommand>`

### OSINT modules (`src/osint/`)

The API integrates 9 external services via the PERA investigation cycle (Plan-Execute-Review-Adjust, ported from Kallisto-OSINTer). Each module gracefully degrades when its API key is not set.

| Module | Service | Env var | Purpose |
|--------|---------|---------|---------|
| `hibp.rs` | Have I Been Pwned | `HIBP_API_KEY` | Email breach lookup |
| `breach_directory.rs` | BreachDirectory (RapidAPI) | `XRAPID_API_KEY` | Username/domain/IP breach search |
| `shodan.rs` | Shodan | `SHODAN_API_KEY` | IP/port/vulnerability scanning |
| `facecheck.rs` | FaceCheck.id | `FACECHECK_API_KEY` | Reverse image face search |
| `reality_defender.rs` | Reality Defender | `REALITY_DEFENDER_API_KEY` | Deepfake/AI-generated image detection |
| `username_search.rs` | Direct HTTP | (none) | Username presence across 11 platforms |
| `dns_lookup.rs` | Google DNS-over-HTTPS | (none) | DNS record enumeration |
| `ip_lookup.rs` | ipapi.co / RDAP | (none) | IP geolocation |

AI modules (`src/ai/`): `moderation.rs` (OpenAI free Moderation API via `OPENAI_API_KEY`), `risk_analyzer.rs` (multi-source scoring + LLM fallback via `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`), `investigation.rs` (PERA cycle orchestrator).

### Deployment

- **Production**: DigitalOcean App Platform, app ID `ddace79c-4a08-49b3-b3da-e17623497a27`
- **URL**: `https://guardr-q7nh2.ondigitalocean.app` (custom domain `guardr.app` pending DNS propagation)
- **Deploy**: `doctl apps create-deployment ddace79c-4a08-49b3-b3da-e17623497a27` (deploys from branch configured in app spec)
- **Ingress**: `/api/*` routes to Rust API service (prefix stripped), `/*` routes to static website
- **Secrets**: API keys are set as encrypted env vars in the DO app spec via `doctl apps update` with `type: SECRET`
- **Auth with doctl**: `doctl auth init -t "$DO_TOKEN"`

### Non-obvious caveats

- **Database path**: The default config (`config/default.toml`) uses `sqlite:/app/data/guardr.db` which is a Docker container path. For local dev, override with `DATABASE_URL="sqlite:./data/guardr.db?mode=rwc"` env var.
- **Migration compile-time embedding**: `sqlx::migrate!("./migrations")` embeds migration SQL at compile time. After adding/modifying migration files, you must `touch src/database.rs` and rebuild for changes to take effect.
- **System dependency**: `libssl-dev` (OpenSSL headers) must be installed for the Rust build to succeed (`openssl-sys` crate).
- **API routes**: Routes are mounted at `/v1/...` (e.g., `/v1/auth/register`), not `/api/v1/...` as documented in the README. The `/api` prefix is stripped by the DO production ingress.
- **Auth enum bug**: The `UserSubscriptionTier` enum has a serialization mismatch — `Display` writes lowercase (`"free"`) but `sqlx::Type` derive expects capitalized (`"Free"`). This causes 500 errors on user registration/login. The `/check` endpoint works without auth.
- **Website API URL**: Set `NEXT_PUBLIC_API_URL` at build time. Local dev: `http://localhost:5000`. DO production: `/api` (relative, routed by ingress).
- **Username search platform quirks**: Instagram, Reddit, LinkedIn, Facebook use auth-wall detection (non-200 status codes like 403/999/400 treated as "profile exists"). TikTok was removed due to aggressive anti-scraping.
- **Risk scoring philosophy**: Breaches = proof of real digital identity (lower risk), not a negative signal. Zero breaches = suspicious (could be fabricated identity).
- **Existing lint warnings**: Both `cargo clippy` and `next lint` produce warnings/errors on existing code. These are pre-existing.
- **Config layering**: `config/default.toml` -> `config/{RUN_MODE}.toml` -> `config/local.toml` -> env vars prefixed with `GUARDR_`. Sensitive values overridden via `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`, and `*_API_KEY` env vars.
