# Changelog

## 1.1.0 — 2026-09-30

### Added

- retryable, permanent/configuration, and invalid-output provider error classes;
- deliberate simulator responses for 400, 401, 403, 408, 429, and common 5xx
  conditions;
- regression validation for permanent pre-classification failures;
- a recovery rule preventing blind retries of invalid structured output;
- spreadsheet-formula and Slack-formatting neutralization for untrusted fields;
- research, reproducibility, threat-model, and public evidence documentation;
- privacy-reviewed portfolio visuals;
- GitHub Actions verification.

### Corrected

- documentation now states precisely that the model supplies bounded components
  and relevance while application code derives the total, label, and action;
- the deterministic injection fixture is described as downstream-containment
  evidence, not proof of real-model prompt-injection resistance.

## 1.0.0 — 2026-09-30

- initial 41-node n8n workflow;
- HMAC-signed intake and atomic PostgreSQL claim;
- strict structured assessment and deterministic outcome mapping;
- Google Sheets upsert and HOT-only Slack alert;
- durable stage recovery, simulator, tests, and handover documentation.
