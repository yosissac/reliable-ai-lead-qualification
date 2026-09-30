# Error Taxonomy Validation

**Date:** 2026-09-30  
**Environment:** local n8n 2.40.7, PostgreSQL 17, internal Responses-compatible
simulator  
**Data:** synthetic only

## Implemented Classification

| Input condition | Result class | Database state | Scheduled retry |
|---|---|---|---:|
| Network error, 408, 429, or 5xx | `retryable_provider_failure` | `FAILED_LLM` | Yes |
| 400, 401, 403, or other non-transient 4xx | `permanent_provider_configuration` | `FAILED_PERMANENT` | No |
| HTTP 2xx with malformed or invalid structured content | `invalid_structured_output` | `FAILED_LLM_OUTPUT` | No blind retry by the new classification |

## Automated Result

The workflow validator passed, Code-node JavaScript parsed, Compose expanded,
and the Node suite passed **13/13 tests**. The simulator now supports deliberate
400, 401, 403, 408, 429, 500, 502, 503, and 504 responses.

## Live n8n/PostgreSQL Result

Two signed synthetic requests were submitted through the real published local
workflow:

```text
HTTP 429 simulation
-> webhook 202 accepted
-> FAILED_LLM
-> last_error_code = provider_http_429
-> next_retry_at populated

HTTP 401 simulation
-> webhook 202 accepted
-> FAILED_PERMANENT
-> last_error_code = provider_http_401
-> next_retry_at null
```

The first 401 run exposed a database constraint that did not permit
`FAILED_PERMANENT` before a classification existed. The constraint was migrated
to support permanent pre-classification failures, and the 401 case then passed
with one AI call and no scheduled retry. This is now covered by the workflow
validator and initialization/migration SQL.

A final recovery-selector audit also found that `FAILED_LLM_OUTPUT` with a null
retry time could still be selected automatically. The selector now requires an
explicit non-null due retry time for that state. Therefore invalid structured
output is not blindly retried by the scheduled worker, while an operator/client
can still deliberately resubmit the same event for controlled recovery.

## Cleanup

- The mock workflow was unpublished.
- Decrypted temporary credential exports were deleted without printing values.
- The isolated screenshot database/container/volume was deleted.
- Local n8n, PostgreSQL, simulator containers, and network were stopped/removed.
- Persistent original n8n and PostgreSQL volumes were preserved.
