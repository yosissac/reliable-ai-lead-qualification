# Design Decisions

This record explains important choices and their trade-offs. It is intentionally
shorter than a full architecture-decision-record collection, but each item can
be promoted to a separate ADR as the project evolves.

## DD-001 — PostgreSQL Is the Processing Source of Truth

**Decision:** Persist claims, stages, attempts, leases, results, and external
operation state in PostgreSQL. Treat Google Sheets as a business-facing view.

**Reason:** Spreadsheet reads followed by writes do not provide a safe atomic
claim under concurrency. A relational transaction and unique constraint do.

**Trade-off:** Deployment is heavier than a Sheets-only workflow and requires
database operation, backup, and migration discipline.

## DD-002 — Separate Submission Identity from Content Identity

**Decision:** Store both a client-supplied submission ID and a canonical
payload hash.

**Reason:** This distinguishes a legitimate replay from accidental or hostile
reuse of an identifier for different content.

**Trade-off:** Canonicalization becomes part of the compatibility contract and
must be versioned carefully.

## DD-003 — Sign Timestamp Plus Exact Raw Body

**Decision:** Verify HMAC-SHA256 over `timestamp + "." + raw_body` and enforce a
time window.

**Reason:** Signing the exact transported bytes protects both content and
freshness. Re-serializing JSON before verification can change byte order or
whitespace and break a sound signature scheme.

**Trade-off:** The ingress must preserve access to the raw request body and
client/server clocks must be sufficiently aligned.

## DD-004 — Bound Model Output, Then Derive the Outcome

**Decision:** Ask the model for relevance and bounded component scores through
a strict schema. Validate those fields and calculate total, qualification, and
recommended action in deterministic code.

**Reason:** This makes thresholds and allowed actions inspectable and prevents
the model from directly declaring an arbitrary final score or side effect.

**Trade-off:** The result still depends on the model-supplied components. This
is constrained model authority, not model-independent scoring.

## DD-005 — Minimize Model Input

**Decision:** Send service, free-text requirement, and limited boolean/context
features rather than direct name, email, phone, or company identifiers.

**Reason:** Those identifiers are unnecessary for the rubric and increase
privacy exposure.

**Trade-off:** Free text can itself contain identifying or sensitive data. A
regulated deployment may need redaction or data-loss-prevention controls.

## DD-006 — Classify Failures Before Retrying

**Decision:** Separate retryable transport/provider failures, permanent or
configuration failures, and successful responses with invalid structured
output.

**Reason:** 408, 429, and typical 5xx responses may heal; 400, 401, and 403
usually need request, credential, or permission changes. Invalid 2xx content
needs quarantine and inspection rather than blind repetition.

**Trade-off:** Provider semantics can evolve. The mapping requires monitoring,
tests, and revision.

## DD-007 — Persist Progress Around External Effects

**Decision:** Record stage state and stable business identifiers so recovery
can resume from known progress.

**Reason:** A remote system may perform a write even if the caller loses the
response. Stable identifiers and upsert/idempotency mechanisms help retries
converge.

**Trade-off:** No architecture can promise universal exactly-once behavior
without compatible third-party semantics. Reconciliation is still required.

## DD-008 — Use a Local Provider Simulator

**Decision:** Include a deterministic, Responses-compatible simulator for
success, malformed output, and selected HTTP failures.

**Reason:** Contributors can test orchestration and failure handling without a
paid API key, external availability, or nondeterministic output.

**Trade-off:** Simulator results do not establish real-model quality,
prompt-injection resistance, latency, or provider conformance beyond the
implemented surface.

## DD-009 — Ship the Workflow Inactive

**Decision:** Keep `active: false` in the version-controlled export.

**Reason:** Importing a public artifact should not immediately expose a webhook
or invoke external services before credentials and configuration are reviewed.

**Trade-off:** Operators must perform an explicit activation step after
acceptance testing.

## DD-010 — Prefer a Reference Architecture over the Smallest Demo

**Decision:** Retain the database, durable stages, recovery path, and evidence
suite in the open-source artifact.

**Reason:** The repository is intended to demonstrate production-minded
engineering and support further evaluation, not only to minimize setup time.

**Trade-off:** This is more complex than many small-business proofs of concept.
Commercial deployments should right-size the architecture to risk, budget, and
expected traffic rather than adopting every component automatically.
