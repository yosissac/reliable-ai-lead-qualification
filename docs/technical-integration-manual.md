# Technical Integration Manual

## AI Lead Qualification Automation

**Audience:** solution architects, automation engineers, DevOps engineers, and
technical implementers  
**Deployment model:** self-hosted n8n + PostgreSQL + Google Sheets + Slack +
OpenAI-compatible Responses endpoint  
**Release state:** productization draft; deploy inactive and complete acceptance
testing before production activation

## 1. Purpose and Boundaries

The solution accepts website lead submissions, verifies and validates each
request, claims the business event atomically, obtains a structured model
assessment, validates bounded scoring components, deterministically calculates
the total/qualification/action, upserts a Google Sheets row, and alerts Slack
only for HOT leads.

It does not build the website form, reply to prospects, determine legal
compliance, or guarantee exactly-once behavior across third-party APIs. It uses
durable state and stable identifiers to make retries converge and to support
reconciliation when a provider accepts an operation but its response is lost.

## 2. Architecture

```text
Trusted website backend
  -> signed HTTPS webhook
  -> authentication + replay check + validation
  -> atomic PostgreSQL claim
  -> immediate accepted/duplicate/conflict response
  -> structured model assessment
  -> component validation + deterministic outcome calculation
  -> durable classification
  -> Google Sheets append-or-update by submission_id
  -> HOT only: Slack alert with stable client_msg_id
  -> completed

Scheduled recovery
  -> claims eligible expired/failed work
  -> resumes at the first unfinished stage
```

PostgreSQL is the processing source of truth. Google Sheets is the business-user
view. n8n orchestrates the stages and stores encrypted provider credentials.

## 3. Prerequisites

- Docker Engine and Docker Compose v2, or an equivalent supported deployment
  platform;
- persistent storage for n8n and PostgreSQL;
- an HTTPS reverse proxy for public deployment;
- a client-owned OpenAI project and API credential;
- Google OAuth access to the target spreadsheet;
- a Slack app with a bot token and `chat:write` permission;
- a trusted server-side component capable of signing the exact request body;
- backup, monitoring, retention, and incident owners.

For local acceptance, Node.js 20+ is required for helpers and automated tests.

## 4. Configuration and Credentials

Keep infrastructure settings in an uncommitted `.env` copied from
`.env.example`. Store application credentials in n8n's encrypted credential
store.

| Credential | Minimum purpose |
|---|---|
| Website Webhook Key | Shared header authentication |
| Website HMAC Secret | HMAC-SHA256 request verification |
| PostgreSQL application credential | Least-privilege processing-state access |
| OpenAI bearer credential | Responses API call |
| Google Sheets OAuth2 | Write access to the chosen spreadsheet |
| Slack bot bearer token | Post messages to the chosen channel |

Use different random values for the webhook key and HMAC secret. Never place a
real signing secret in browser JavaScript.

Runtime configuration must define:

- OpenAI-compatible endpoint and permitted model;
- Google spreadsheet ID and tab name;
- Slack channel ID;
- retry ceiling and backoff policy;
- replay tolerance and any environment-specific limits.

## 5. Installation

```bash
cp .env.example .env
# Replace placeholders locally; do not commit this file.
docker compose config
docker compose up -d
docker compose ps
```

Open n8n, create the owner account, and keep the imported workflow inactive.
Import `workflows/lead-qualification.json`, attach credentials by their
documented names, and enter the target Sheet/tab/channel values.

The database initialization creates the processing schema and application role.
Confirm that the application role cannot create arbitrary schemas or access
unrelated databases.

## 6. Website Request Contract

Send a JSON `POST` from a trusted backend. Required business fields are
`submission_id`, `name`, `email`, `service`, and `message`. Optional fields
include `submitted_at`, `company`, `phone`, and `source`.

Required headers:

```text
Content-Type: application/json
X-Webhook-Key: <shared key>
X-Webhook-Timestamp: <current Unix seconds>
X-Webhook-Signature: sha256=<lowercase hex HMAC>
```

Signature input:

```text
timestamp + "." + exact_raw_request_body
```

Serialize once, sign those exact bytes, and send the same bytes. Generate a
globally unique, stable `submission_id` before the first request and reuse it
only when retrying the same business event.

## 7. Response Semantics

| HTTP | Status | Integration behavior |
|---:|---|---|
| 202 | `accepted` | Persisted for asynchronous processing |
| 200 | `duplicate` | Same completed event; do not create a new ID |
| 202 | `already_processing` | Another worker owns it; poll or reconcile later |
| 202 | `accepted_for_retry` | Existing failed event reclaimed |
| 400 | `validation_failed` | Correct the payload; do not blindly retry |
| 401/403 | authentication/signature error | Correct authentication or investigate abuse |
| 409 | `submission_id_conflict` | Same ID has different content; stop and investigate |
| 415 | content-type error | Send JSON with the correct content type |
| 422 | `manual_review_required` | Automatic processing stopped; operator action required |

A `202` confirms durable intake, not completion of every downstream service.

## 8. Model Contract and Decision Logic

The request sends only fields needed for qualification, minimizing direct
personal data. The model must return strict structured output containing:

- `is_relevant`;
- a category and short evidence-based reason;
- five integer score components, each from 0–20;
- a proposed score, qualification, and action.

The model provides the semantic component scores and relevance. The workflow
validates the ranges and shape, adds the components, and deterministically maps:

- 75–100 → HOT → `CONTACT_SALES`;
- 50–74 → WARM → `MANUAL_REVIEW`;
- 0–49 and relevant → COLD → `NURTURE`;
- not relevant → NOT_RELEVANT → `NO_ACTION`.

This constrains model authority but does not make the assessment independent of
the model.

## 9. Failure Taxonomy

| Class | Examples | Default handling |
|---|---|---|
| Retryable provider failure | timeout/network, 408, 429, 5xx | bounded exponential retry with durable state |
| Permanent/configuration failure | 400, 401, 403, unsupported model, invalid project permission | stop automatic retries; operator correction required |
| Invalid structured output | 2xx response with missing, refused, malformed, or out-of-range content | no external side effect; manual review or tightly limited policy retry |
| Downstream temporary failure | transient Google/Slack/network issue | resume from saved stage without repeating completed stages |

Sanitize stored error messages. Do not persist authorization headers, tokens,
full provider responses containing sensitive data, or unnecessary lead content.

## 10. Google Sheets Integration

Create the configured tab with the documented header row. Use
`submission_id` as the match key for append-or-update behavior. Restrict OAuth
access to the intended account and spreadsheet where the provider supports it.

The workflow persists the classification before attempting Sheets. A retry must
reuse that saved result rather than call the model again.

## 11. Slack Integration

Install a Slack app with the minimum `chat:write` bot scope and invite it to the
target channel. Use the channel's stable `C...` identifier, not its display
name or email address. Send only HOT alerts after deterministic outcome mapping.

Reuse the persisted `notification_client_id` on retries and verify Slack's
JSON-level success indicator, not only the HTTP status.

## 12. Acceptance Test

Run the static suite first:

```bash
node scripts/validate-workflow.mjs
node --test tests/*.test.mjs
bash -n db/init/001_lead_automation.sh
docker compose config --quiet
```

Then prove in a non-production environment:

1. valid HOT, WARM, and COLD synthetic leads;
2. one Sheet row per ID and Slack only for HOT;
3. exact completed duplicate with no repeated effects;
4. concurrent identical submissions with one processing owner;
5. same ID/different payload conflict;
6. invalid signature, stale timestamp, and invalid body rejection before model use;
7. retryable 429/503/timeout recovery;
8. permanent 400/401/403 behavior with no retry loop;
9. malformed successful model response with no downstream side effect;
10. Sheets and Slack failure recovery from the saved stage.

Finally, use a client-owned OpenAI credential for one synthetic end-to-end smoke
test and verify account access, selected model, structured output, budgets, and
provider logging policy.

## 13. Production Hardening

- TLS termination, editor authentication, body-size limits, and rate limiting;
- network isolation for PostgreSQL;
- scoped credentials and scheduled rotation;
- OpenAI project budget and usage alerts;
- encrypted backups of PostgreSQL and n8n data plus the matching encryption key;
- tested restoration procedure;
- failure-age, retry-count, disk, certificate, and container-health monitoring;
- documented retention/deletion policy and incident ownership;
- staged upgrades with workflow export and regression tests.

## 14. Operations and Recovery

Monitor completed volume, oldest failed item, retry rate, model usage, Sheet
continuity, Slack delivery, and infrastructure health. Do not manually mark an
item completed until its required external side effect has been verified.

For a permanent provider failure, correct the credential, permission, endpoint,
model, or request configuration first. Then perform a controlled retry using
the same submission record. For ambiguous provider acceptance, reconcile the
stable business/message identifier before retrying.

## 15. Change Control

Treat scoring thresholds, model instructions, destination columns, Slack
message content, and retry rules as versioned behavior. Export an inactive
backup, test against synthetic fixtures, update the changelog, and rerun the
full acceptance suite before activation.
