# Zero-Cost OpenAI-Compatible Mock Test Report

**Date:** 2026-09-29
**Scope:** Real n8n/PostgreSQL execution against an internal OpenAI Responses-compatible simulator
**Cost:** $0; no OpenAI account or API key used
**External services:** Google Sheets and Slack intentionally not connected yet

> Follow-up: real Google Sheets and Slack acceptance later passed. See
> `external-integration-acceptance-report.md` for the current external-service
> evidence and the remaining real-OpenAI boundary.

## Safety Boundary

The production export defaults to:

```text
https://api.openai.com/v1/responses
gpt-5.6-luna
```

The generator created a separate inactive workflow with a different ID and name:

```text
AILeadQualMock202609
AI Lead Qualification - MOCK TEST ONLY
```

Only that generated workflow used:

```text
http://mock-openai:8080/v1/responses
mock-gpt-5.6-luna
```

The simulator ran inside the Docker network. Port 8080 was never published to the host.

## Automated Simulator Tests

The Node test suite proved:

- Bearer authorization is required;
- a strict `text.format` JSON Schema request is required;
- the supplied HOT, COLD, and CRM leads receive deterministic Responses-shaped output;
- deliberate HTTP 503, malformed JSON, wrong-schema, and fail-once modes work;
- the statistics endpoint always reports `real_api_called: false`.

Combined project test result: **12 tests passed, 0 failed**.

## Real n8n Results

Every row below came through the real signed n8n webhook, real Code nodes, real HTTP Request node, real output validator, and real PostgreSQL persistence.

| Test | HTTP response | Persisted result | Status |
|---|---|---|---|
| Bright Logistics-style lead | `202 accepted` | HOT, score 96, one mock AI call | PASS; stopped safely at unconfigured Sheets |
| Exploratory lead | `202 accepted` | COLD, score 15 | PASS; no notification |
| HubSpot lead | `202 accepted` | HOT, score 76, `BUSINESS_SYSTEMS_INTEGRATION` | PASS; stopped safely at unconfigured Sheets |
| Fail once, first submission | `202 accepted` | `FAILED_LLM`, retry state saved | PASS |
| Fail once, same lead resubmitted | `202 accepted_for_retry` | HOT, score 96, same database record, two total mock calls | PASS |
| Malformed output | `202 accepted` | `FAILED_LLM_OUTPUT`, `invalid_structured_output` | PASS |
| Persistent 503 | `202 accepted` | `FAILED_LLM`, `openai_transport_failure` | PASS |
| Deliberately inconsistent HOT output | `202 accepted` | overridden to `NOT_RELEVANT`, score 0, `guardrail_overridden=true` | PASS |

The HOT, COLD, CRM, and guardrail cases subsequently reached `FAILED_SHEETS`. That is the expected boundary because no Google credential was connected. Their validated classifications were already durably saved, while `sheet_written=false` and `notification_sent=false` prevented false completion claims.

## Simulator Statistics

At the end of the live run:

```json
{
  "total_requests": 8,
  "unique_request_bodies": 7,
  "scenarios": {
    "fail_once_503": 1,
    "false_hot": 1,
    "http_503": 1,
    "malformed_json": 1,
    "success": 4
  },
  "real_api_called": false
}
```

## What This Proves

- n8n sends the intended strict Responses API-shaped request.
- The HTTP credential injects a Bearer header.
- The workflow accepts and parses a successful Responses-shaped envelope.
- Application code validates model-supplied bounded components and relevance,
  then deterministically recalculates the total, qualification, and action.
- The injection-style fixture proves downstream containment for a safe
  deterministic simulator response. It does not prove that a real model resists
  prompt injection.
- Transport and structured-output failures are separated and durably recorded.
- A failed lead can resume using the same business record.
- No real OpenAI endpoint or paid account is required for these tests.

## What This Simulator Run Did Not Prove

- Real OpenAI authentication, model behavior, availability, rate limits, and billing.
- Google Sheets or Slack behavior during this particular run.

Google Sheets and Slack were exercised later with the same simulator boundary;
see `external-integration-acceptance-report.md`.

## Shutdown

After evidence collection:

- the mock workflow was unpublished;
- n8n, PostgreSQL, and the simulator containers/network were stopped and removed;
- the named n8n and PostgreSQL volumes were preserved;
- the generated mock workflow and decrypted test-credential export were removed from the workspace;
- port 5678 was confirmed closed;
- port 8080 was confirmed not published.
