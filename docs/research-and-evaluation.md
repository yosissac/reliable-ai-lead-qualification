# Research and Evaluation Framework

## Research Motivation

Language models can add useful semantic judgment to business automation, but
their outputs are probabilistic and provider calls can fail in ways that are
different from ordinary deterministic functions. This implementation studies
how an LLM can participate in an operational workflow while deterministic
software retains authority over validation, state transitions, retries, and
external side effects.

The artifact is both working software and an initial experimental platform. It
is not presented as a completed empirical study of lead-quality prediction.

## Research Questions

1. Can an atomic database claim prevent duplicate business effects when
   concurrent or repeated submissions use the same identifier?
2. Can stage-aware recovery resume interrupted work without deliberately
   repeating already-confirmed Sheets or Slack operations?
3. Can a strict output schema plus deterministic post-processing bound the
   model's authority over the final business decision?
4. Can direct contact data be excluded from the model request while retaining
   the information needed for an initial qualification assessment?
5. Which provider failures should be retried, quarantined, or escalated for
   operator action?
6. Under representative real-model conditions, how accurate, calibrated,
   fair, fast, and cost-effective is the semantic assessment?

Questions 1–5 are addressed by implementation and deterministic testing in
this repository. Question 6 remains a planned empirical evaluation.

## System Proposition

The design separates two forms of responsibility:

- **Probabilistic inference:** the model assesses relevance and proposes five
  bounded scoring components from a minimized lead description.
- **Deterministic control:** the workflow checks types and ranges, calculates
  the total, maps the total to a qualification and action, persists state, and
  decides whether external operations may occur.

This is a containment strategy, not a claim that the final assessment is
independent of the model. The model-generated components materially influence
the deterministic result.

## Testable Hypotheses

| ID | Hypothesis | Current evidence | Status |
|---|---|---|---|
| H1 | Concurrent identical submissions converge on one durable business record. | Atomic-claim logic, concurrent-request fixture, workflow tests. | Supported in the tested local configuration. |
| H2 | Reusing an ID with different content is reported as a conflict rather than silently overwritten. | Payload hash comparison and conflict fixture. | Supported deterministically. |
| H3 | Invalid or out-of-range model fields cannot directly select the final label or action. | Strict schema, post-response validation, deterministic mapping tests. | Supported for covered malformed outputs. |
| H4 | Retryable provider failures are separated from permanent/configuration failures. | 400/401/403/408/429/5xx simulator cases and workflow validation. | Supported deterministically and by targeted local execution. |
| H5 | Recovery avoids deliberately reissuing a confirmed Slack operation. | Persisted notification identity and stage gates. | Supported by structural and scenario tests; third-party exactly-once delivery is not claimed. |
| H6 | The minimized model input provides useful qualification performance on representative leads. | No labeled real-model benchmark is included. | Unresolved. |
| H7 | The prompt and controls resist adversarial instructions in real model traffic. | A deterministic fixture verifies safe downstream handling only. | Unresolved for real models. |

## Evaluation Method

### Implemented evaluation

The repository uses three evidence layers:

1. **Static validation** checks workflow structure, inactive export state,
   connected critical stages, credential references, and JavaScript parsing.
2. **Deterministic unit and simulator tests** exercise canonicalization,
   signing, error taxonomy, score mapping, malformed output, and recovery
   invariants without paid provider calls.
3. **Local integration and acceptance evidence** records container execution
   and real test-account interactions with Google Sheets and Slack using
   synthetic data.

Commands and environment assumptions are specified in
[Reproducibility](reproducibility.md). Sanitized reports are stored in
[`../evidence/`](../evidence/).

### Proposed real-model evaluation

A publishable follow-up study should pre-register:

- an inclusion policy and a privacy-safe, expert-labeled lead dataset;
- qualification definitions and scoring-rubric version;
- primary metrics such as macro F1, class recall, weighted disagreement, and
  calibration error;
- operational metrics such as latency, token usage, retry rate, and cost per
  completed lead;
- false-HOT and false-COLD cost assumptions;
- demographic, linguistic, industry, and message-length slices;
- blinded expert adjudication and inter-rater agreement;
- prompt, model, schema, temperature, date, and provider-version controls;
- adversarial instructions separated from ordinary low-quality inputs;
- confidence intervals and a rule for handling provider failures.

A suitable comparison would hold the schema and rubric constant while
evaluating: deterministic rules alone, one or more models, and a hybrid policy
with human review for ambiguous cases.

## Evidence and Claim Boundaries

What has been demonstrated:

- the exported workflow is structurally valid and inactive;
- the deterministic suite passes 13 tests;
- the simulator can reproduce success and selected provider failures;
- local n8n/PostgreSQL execution was exercised;
- Google Sheets and Slack were exercised through real test integrations;
- the published screenshots use synthetic test leads and have been reviewed
  for portfolio publication.

What has not been demonstrated:

- predictive quality, calibration, fairness, or prompt-injection resistance of
  a live OpenAI model;
- production availability, throughput, or disaster recovery;
- legal or regulatory compliance in a particular jurisdiction;
- universal exactly-once behavior across third-party APIs;
- business uplift or sales conversion impact;
- operation with real customer data.

The `WEB-INJECTION` fixture does not test a real model. It proves only that a
safe simulated structured response is handled correctly and that untrusted
lead text is not granted direct control over workflow tools.

## Validity Threats

### Construct validity

The five-component rubric is an engineered proxy for commercial lead quality.
It has not yet been validated against sales outcomes or expert consensus.

### Internal validity

The simulator is deterministic and intentionally conforms to known response
shapes. It cannot reproduce the full distribution of model behavior, provider
changes, or network failure modes.

### External validity

Synthetic fixtures and one test integration environment may not generalize to
other industries, languages, n8n deployments, account policies, or traffic
patterns.

### Conclusion validity

Passing scenario tests establishes behavior for those scenarios; it does not
estimate population-level accuracy or operational reliability. No statistical
significance claim is made.

## Responsible Interpretation

The strongest present contribution is the architecture and its reproducible
failure-handling logic. Any claim about model decision quality requires a
separate, representative real-model study. For consequential deployments,
model output should inform a documented human-review policy rather than serve
as an unreviewed eligibility or access decision.
