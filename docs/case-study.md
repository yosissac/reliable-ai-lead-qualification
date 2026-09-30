# Engineering Case Study

## Secure, Recoverable AI Lead Qualification

### Executive Summary

This project is an open-source reference implementation for qualifying inbound
website leads with an LLM-compatible API while keeping deterministic software
in control of validation, state, retries, and business side effects.

It accepts signed submissions, prevents concurrent duplicate processing,
requests a constrained semantic assessment, calculates the final outcome from
validated bounded components, updates Google Sheets, and alerts Slack only for
HOT leads. Durable stages allow interrupted work to resume without deliberately
repeating completed operations.

### Business Problem

A simple webhook-to-model automation can work in a demonstration and still
fail operationally. Common failure modes include:

- the source retries a submission;
- two copies arrive at the same time;
- an identifier is reused for changed content;
- the provider times out or rate-limits the request;
- a model returns malformed or inconsistent data;
- a downstream write succeeds but its acknowledgement is lost;
- a permanent credential error is retried as if it were temporary.

These failures can waste API spend, create duplicate records, alert the wrong
team, or leave operators unsure about what completed.

### Engineering Approach

The solution combines:

- HMAC-SHA256 request signing with freshness checks;
- validation before model cost or external side effects;
- atomic PostgreSQL claims, payload hashes, leases, and stage state;
- minimized model input and a strict structured-output schema;
- deterministic calculation of total score, label, and action;
- Google Sheets append-or-update by stable submission ID;
- HOT-only Slack notification with a stable message identity;
- recovery from the saved stage;
- explicit retryable, permanent/configuration, and invalid-output failures;
- Dockerized setup, synthetic fixtures, automated tests, and operator manuals.

### Architecture Result

```text
signed lead -> authenticate -> validate -> atomic claim
                                         -> structured assessment
                                         -> validate components
                                         -> deterministic decision
                                         -> persist
                                         -> Sheets upsert
                                         -> HOT? -> Slack

failed/interrupted stage -> scheduled recovery -> resume saved work
```

PostgreSQL is the processing source of truth; the spreadsheet is the
business-facing register. This division allows spreadsheet convenience without
using a spreadsheet as a concurrency-control mechanism.

### Demonstrated Outcomes

- 13/13 productization tests pass;
- a 41-node n8n export passes structural and Code-node validation;
- valid, tampered, stale, concurrent, duplicate, and conflicting signed
  submissions were exercised;
- 400/401/403/408/429 and representative 5xx provider conditions are classified;
- real test-account Google Sheets writes were demonstrated using synthetic HOT,
  WARM, COLD, and not-relevant leads;
- real test-workspace Slack alerts were demonstrated for HOT leads;
- an exact completed duplicate repeated neither the recorded model call nor the
  Sheets/Slack effects;
- credentials and private account identifiers are excluded from the repository.

The model stage in the published acceptance demonstration used the included
deterministic simulator. Real-model accuracy, calibration, fairness, latency,
cost, and adversarial robustness remain research and deployment tasks.

### Industrial Significance

The artifact demonstrates API integration, workflow orchestration, database
concurrency, idempotency, recovery design, security boundaries, privacy
minimization, automated verification, and technical handover. Its controls can
be adapted to CRM intake, service requests, document routing, support triage,
and other workflows where probabilistic inference precedes deterministic
business actions.

### Research Significance

The project provides a concrete platform for studying hybrid
probabilistic/deterministic systems. It frames measurable questions about:

- model-versus-human agreement and calibration;
- operational cost and latency under retry policies;
- adversarial instruction handling;
- reliability of external side effects;
- privacy/utility trade-offs from input minimization;
- fairness across language and business-context slices;
- human-review thresholds and asymmetric error costs.

The repository states evidence classes and validity limits so later experiments
can extend the artifact without turning simulator behavior into unsupported
model-performance claims.

### Technologies

`n8n` · `PostgreSQL` · `Docker Compose` · `Node.js` · `OpenAI Responses-compatible API` · `Google Sheets OAuth` · `Slack API` · `HMAC-SHA256`

### Reuse and Extension

Potential extensions include CRM adapters, review queues, rubric versioning,
observability, retention automation, benchmark datasets, model comparisons, and
calibration studies. See the [roadmap](../ROADMAP.md) and
[research framework](research-and-evaluation.md).

### Disclosure

This is a self-directed engineering and research portfolio project, not a
customer testimonial. Published records are synthetic and screenshots use test
accounts. External Google Sheets and Slack integrations were exercised; live
OpenAI model evaluation is not claimed.
