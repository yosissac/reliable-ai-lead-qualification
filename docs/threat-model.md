# Threat Model

## Scope and Security Objectives

The system accepts website lead submissions, invokes a model-compatible API,
persists workflow state, writes a business register, and may alert a sales
channel. Its primary security objectives are:

- accept requests only from an authorized backend and reject stale replays;
- preserve lead integrity across retries and concurrent submissions;
- prevent untrusted lead text from controlling workflow tools or credentials;
- minimize personal data sent to the model;
- keep secrets outside exported workflows and source control;
- avoid duplicate or misleading downstream side effects;
- retain enough state for investigation and safe recovery.

## Assets

- contact and company data submitted by prospective customers;
- qualification results and processing history;
- webhook, database, model, Google, and Slack credentials;
- spreadsheet and Slack channel contents;
- workflow definitions, prompts, and scoring rules;
- service availability and operator trust in notifications.

## Trust Boundaries

```text
Public network
  -> HTTPS ingress / website backend
  -> authenticated n8n webhook
  -> n8n execution and credential store
  -> PostgreSQL processing state
  -> model provider
  -> Google Sheets / Slack
  -> business users
```

Lead fields are untrusted even after transport authentication. Provider output
is also untrusted until its structure, types, ranges, and permitted values have
been checked.

## Threats, Controls, and Residual Risk

| Threat | Implemented control | Residual risk / deployment action |
|---|---|---|
| Forged webhook request | Header credential plus HMAC-SHA256 over timestamp and exact raw body. | Protect secrets, require TLS, rate-limit ingress, rotate credentials. |
| Captured-request replay | Signed timestamp and acceptance window. | Clock drift and replay within the window remain; atomic submission claim limits effects. |
| Duplicate/concurrent submission | Unique submission ID, payload hash, atomic claim, lease, and transaction locking. | Third-party acknowledgements can still be lost; reconcile external systems. |
| Same ID used for different content | Hash mismatch becomes an explicit conflict. | Operator needs a documented correction/re-submission process. |
| Prompt injection in lead text | No direct model tool access; strict response schema; deterministic post-processing; fixed destinations. | Real-model resistance is unmeasured; adversarial evaluation and monitoring remain necessary. |
| Malformed or malicious provider output | Type/range/enum validation and invalid-output quarantine. | Novel parser/provider behavior may require additional validation. |
| Excessive personal-data disclosure | Model request omits direct name, email, phone, and company identifiers not required by the rubric. | Free-text messages can still contain personal or sensitive data; add redaction/DLP where required. |
| Credential disclosure | n8n credential references, inactive export, `.env` exclusion, secret-pattern validation. | Runtime host compromise, logs, screenshots, or operator error can expose secrets. |
| Unbounded retries / cost amplification | Retryable versus permanent/configuration versus invalid-output taxonomy; retry caps and backoff. | Misclassification or provider behavior changes can still cause cost or delay. |
| Duplicate Slack alert | Stable notification identity, persisted stage, Slack response validation. | Exactly-once behavior depends on third-party semantics; perform reconciliation. |
| Spreadsheet overwrite or formula injection | Match on stable submission ID; neutralize formula-leading untrusted text before writing. | Spreadsheet permissions, locale behavior, and manual edits still require deployment-specific policy and testing. |
| Database privilege escalation | Separate application user and scoped grants. | Harden the host/network, patch images, rotate passwords, and audit grants. |
| Slack formatting or mention injection | Escape Slack control characters in untrusted lead/model text before composing the alert. | Re-test when message formatting or Block Kit payloads change. |
| Unauthorized n8n editor access | Local-only Compose binding by default. | Production needs authenticated HTTPS ingress; never expose the editor directly. |
| Availability loss | Durable stages, leases, scheduled recovery, container health checks. | Single-host deployment remains a failure domain; backups and monitored production architecture are required. |

## Abuse Cases

1. An attacker floods correctly formed but invalid requests to consume workflow
   resources. Apply edge rate limits before n8n and alert on rejection rates.
2. A compromised website server sends valid signed submissions containing
   hostile text. Treat field content as untrusted despite valid transport
   authentication.
3. A provider credential loses access and returns 401/403. Mark the case as
   permanent/configuration failure and alert an operator instead of retrying.
4. A successful Sheets or Slack request times out before acknowledgment. Use
   stable business identifiers and reconcile rather than assuming success or
   blindly creating a second effect.
5. A screenshot or exported execution leaks personal data. Use synthetic data,
   redact publication artifacts, and restrict execution-log access.

## Deployment Checklist

- terminate TLS at a maintained authenticated ingress;
- store all secrets in a managed secret/credential system;
- restrict egress and network access by service role;
- use least-privilege Google, Slack, and database scopes;
- establish log redaction, retention, backup, and restoration tests;
- monitor authentication failures, queue age, retries, permanent failures, and
  reconciliation mismatches;
- define incident response and credential-rotation procedures;
- run dependency, container, and repository secret scanning;
- document human review and appeal/correction paths;
- perform a data-protection and legal review for the target jurisdiction.

## Out of Scope

The public artifact does not claim protection against a compromised host,
malicious administrator, vulnerable upstream n8n/container version, compromised
third-party account, or every application-layer denial-of-service technique.
