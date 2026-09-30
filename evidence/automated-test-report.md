# Automated Test Report

**Date:** 2026-09-28
**Updated:** 2026-09-30 (productization hardening)
**Environment:** Node.js 20.20.2, Docker CLI 29.1.3, Docker Compose 2.40.3
**Evidence level:** This report covers static validation and in-memory mocked behavior; live local integration has a separate linked report

## Results

| Check | Result | What it proves |
|---|---|---|
| Workflow JSON parses | PASS | Export is valid JSON |
| 41 unique nodes, valid connections, and parsable Code nodes | PASS | No duplicate node names/IDs, dangling graph connections, or JavaScript syntax errors |
| Workflow inactive; credential placeholders only | PASS | Safer import and no recognized literal key/token patterns |
| Required safety stages present | PASS | Validation, atomic claim, guarded structured output, Sheets upsert, Slack client ID, and recovery exist |
| Lead validation and normalization | PASS | Invalid data is rejected before modeled paid work |
| HMAC current/tampered/stale cases | PASS | Correct signature accepted; changed body and replay rejected |
| Provider error taxonomy | PASS | Network/408/429/5xx are retryable; 400/401/403/other 4xx are permanent; successful malformed content remains an output-validation failure |
| Deterministic outcome guard | PASS | Model-supplied bounded components are validated; total, label, and action are recalculated, while model-supplied relevance remains explicit |
| Three supplied leads | PASS (MOCKED) | WEB-001 HOT, WEB-002 COLD, WEB-003 HOT under the test component scores |
| WEB-001 duplicate | PASS (MOCKED) | One record, one row, one AI call, one notification |
| Reused ID with changed payload | PASS (MOCKED) | Conflict returned and original business row preserved |
| Malformed model response | PASS (MOCKED) | No Sheet or notification side effect |
| Sheets failure/recovery | PASS (MOCKED) | AI called once; upsert retried; one final row and notification |
| Slack failure/recovery | PASS (MOCKED) | AI and Sheets not repeated; one stable notification identity |
| Database init shell syntax | PASS | Initialization script is valid Bash syntax |
| Docker Compose configuration | PASS | Compose expands successfully with test-only environment values |
| Mock requires Bearer auth and strict schema | PASS | Test service rejects missing auth and non-strict requests |
| Mock supplied-lead responses | PASS | Responses-shaped HOT/COLD/HOT results are deterministic |
| Mock failure controls | PASS | 503, malformed JSON, wrong schema, and fail-once modes behave deliberately |

Original accepted baseline: **12 tests, 12 passed, 0 failed**.

Productization-hardened summary: **13 tests, 13 passed, 0 failed**.

## Live Evidence

See `live-container-test-report.md` for the real n8n 2.40.7, PostgreSQL 17, signed-webhook, concurrency, conflict, and database-permission tests.

See `zero-cost-mock-test-report.md` for real n8n execution against the internal OpenAI-compatible simulator.

See `external-integration-acceptance-report.md` for real Google Sheets writes, a real Slack HOT notification, and completed-duplicate suppression after both external effects.

## Not Proven by This Report

- Real OpenAI structured output or decision quality
- Production reliability or service levels

Google Sheets and Slack were proven later with authorized test credentials and
are documented separately. Portfolio screenshots were also captured later.
Real OpenAI still requires an operator-owned credential and enabled model, and
is not represented as live.
