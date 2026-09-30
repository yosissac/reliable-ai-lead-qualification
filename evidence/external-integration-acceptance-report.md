# External Integration Acceptance Report

**Date:** 2026-09-29  
**Workflow:** `AI Lead Qualification - MOCK TEST ONLY`  
**External services:** Real Google Sheets and real Slack test workspace  
**AI boundary:** Internal OpenAI Responses-compatible simulator; no real OpenAI API call or cost

## Result

Google Sheets and Slack both passed live acceptance through the real n8n
workflow. All submitted lead data was synthetic.

| Submission | Classification | Google Sheets | Slack | Result |
|---|---:|---:|---:|---|
| `LIVE-20260929-COLD-001` | COLD / 15 | written | correctly skipped | PASS |
| `LIVE-20260929-HOT-002` | WARM / 58 | written | correctly skipped | PASS |
| `LIVE-20260929-HOT-003` | HOT / 96 | written | sent | PASS |
| exact repeat of `LIVE-20260929-HOT-003` | duplicate | not repeated | not repeated | PASS |

The completed HOT record retained `ai_call_count=1` and `attempt_count=1`
after the exact repeat. Its HTTP response was `200 duplicate`, proving the
repeat did not invoke AI or repeat either external side effect.

## Configuration Finding and Repair

The first external HOT test wrote successfully to Google Sheets but Slack
returned `not_authed`. Safe structural inspection showed that the stored bot
token credential existed, but its header name and Bearer formatting were
incorrect.

The credential was normalized in the local encrypted n8n credential store to:

```text
Header: Authorization
Value format: Bearer [bot token]
```

The token itself was never printed, returned to chat, or written to project
files. A new deterministic HOT test then completed with both
`sheet_written_at` and `notification_sent_at` populated.

## Evidence Boundaries

This run proves:

- Google OAuth was accepted by the real Google Sheets node;
- the supplied spreadsheet and `Leads` tab accepted real append-or-update writes;
- the Slack bot token, `chat:write` scope, channel membership, and channel ID
  allowed a real HOT alert;
- COLD and WARM leads did not send Slack notifications;
- an exact completed duplicate repeated neither Sheets nor Slack;
- the simulator continued to report `real_api_called=false`.

This run does not prove real OpenAI authentication, model quality, availability,
rate limits, or billing. An operator-owned OpenAI credential still needs one
final production smoke test before launch.

## Cleanup

- The mock workflow was unpublished.
- Exact decrypted temporary credential exports were deleted.
- The generated mock workflow file was deleted; the production export remained
  unchanged.
- n8n, PostgreSQL, the simulator, and their Docker network were stopped and
  removed.
- The named n8n and PostgreSQL volumes were preserved.
- Ports 5678 and 8080 were confirmed closed/not published.
