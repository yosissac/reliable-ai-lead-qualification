# Live Container Test Report

**Date:** 2026-09-28  
**Scope:** Local n8n/PostgreSQL integration and real HTTP webhook behavior  
**External-service scope:** OpenAI failure boundary only; Google Sheets and Slack not called live

> This report records the earlier container/webhook test stage. Real Google
> Sheets and Slack acceptance later passed; see
> `external-integration-acceptance-report.md`.

## Environment Proven

| Item | Result |
|---|---|
| Docker Engine | 29.1.3 |
| Docker Compose | 2.40.3 |
| n8n container | 2.40.7; healthy |
| PostgreSQL container | 17.11 Alpine; healthy |
| n8n listener | `127.0.0.1:5678` only |
| PostgreSQL exposure | Internal Docker network only; no host port |
| n8n health endpoint | `{"status":"ok"}` |

## Database Initialization and Permissions

The initialization script ran successfully on a new volume and created:

- role `lead_app`;
- schema `lead_automation`;
- tables `lead_processing` and `processing_events`;
- retry/lease/event indexes;
- the `updated_at` trigger.

As `lead_app`, live tests proved:

- processing-row insert: PASS;
- processing-row update/select: PASS;
- event insert: PASS;
- processing-row delete: DENIED as intended;
- event-table truncate: DENIED as intended.

The owner removed only the generated permission-test row afterward.

## Workflow Import

The delivered workflow imported through the real n8n CLI and appeared as:

```text
AILeadQual202609|AI Lead Qualification - Reliable Intake and Recovery
```

The workflow was published temporarily for local testing. Its export remains
inactive by default for safe operator import.

The live import exposed and led to fixes for:

1. A missing top-level workflow ID required by n8n 2.40.7 CLI import.
2. Crypto node output-field normalization during published execution.
3. A restrictive host-directory mount that initially prevented PostgreSQL from reading the init directory.
4. Deprecated `WEBHOOK_URL` and `N8N_RUNNERS_ENABLED` Compose settings.

All corrected versions were re-imported and re-tested.

## Real HTTP Results

| Test | Real result | Status |
|---|---|---|
| Correct key, timestamp, HMAC, and WEB-001 body | `202 accepted` | PASS |
| Incorrect HMAC | `401 invalid_signature` | PASS |
| Stale timestamp | `401 stale_or_invalid_timestamp` | PASS |
| Incorrect header key | `403 Authorization data is wrong!` before workflow work | PASS |
| Missing `submission_id` | `400 validation_failed` | PASS |
| Two simultaneous WEB-001 requests | one `202 accepted`; one `202 already_processing` | PASS |
| Same ID with changed content | `409 submission_id_conflict` | PASS |
| Changed content after conflict | original message remained unchanged; one row | PASS |
| Previously completed WEB-001 resent | `200 duplicate`; one row; AI counter unchanged | PASS (completion state simulated; HTTP/database behavior live) |
| WEB-002 and WEB-003 valid signed bodies | both `202 accepted` and durably stored | PASS |

## Failure-Boundary Evidence

The OpenAI credential was deliberately fake and test-only. For accepted leads, the workflow:

- reached the strict AI request stage;
- recorded a retryable AI failure in PostgreSQL;
- incremented the saved AI-call counter once;
- scheduled a future retry;
- did not mark a classification, Sheet write, or Slack notification as complete.

During the simultaneous WEB-001 test, PostgreSQL showed:

```text
rows for WEB-001: 1
attempt_count: 1
ai_call_count: 1
AI_FAILED events: 1
sheet_written: false
notification_sent: false
```

This is real evidence that the atomic duplicate claim prevents duplicate paid/downstream work at intake.

For the completed-duplicate test, the test row was deliberately moved to a completed state directly in PostgreSQL because no real OpenAI, Sheets, or Slack credentials were available. The subsequent signed webhook request and duplicate response were executed live. This proves completed-record intake behavior, not successful external-service delivery.

## Mocked Versus Live Boundary

The following are **not** claimed as live:

- OpenAI producing a valid structured classification;
- Google Sheets creating/updating a real row;
- Slack delivering a real HOT-lead alert.

At this historical test stage, their rule logic, malformed-output handling,
saved-stage recovery, upsert behavior, and stable notification identity were
covered by the then-current mocked suite. Google Sheets and Slack were exercised
later and are recorded in `external-integration-acceptance-report.md`.

## Screenshots

Screenshots were not captured during this early container test. Publication
images were captured during later acceptance and are documented in
`../docs/visual-evidence.md`.

## Test Shutdown

After verification, the test workflow was unpublished and the containers/network were stopped and removed with `docker compose down`. The named n8n and PostgreSQL volumes were preserved, and the local `127.0.0.1:5678` listener was confirmed closed.
