# Reproducibility Guide

## Scope

This guide reproduces the public artifact's static checks and deterministic
tests. It also explains which evidence depends on external accounts and cannot
be reproduced from the repository alone.

## Reference Environment

- Linux host with Docker Engine and Docker Compose v2;
- Node.js 20 or newer;
- n8n and PostgreSQL versions pinned through `.env`;
- local n8n listener bound to `127.0.0.1`;
- synthetic fixtures under `tests/fixtures/`.

Record the output of these commands when publishing new results:

```bash
node --version
npm --version
docker --version
docker compose version
git rev-parse HEAD
```

## Deterministic Verification

No external credentials are needed for the repository checks:

```bash
npm install --package-lock-only --ignore-scripts
npm run check
bash -n db/init/001_lead_automation.sh

POSTGRES_PASSWORD=test-owner-password \
LEAD_DB_PASSWORD=test-app-password \
N8N_ENCRYPTION_KEY=test-only-encryption-key-at-least-32-characters \
docker compose config --quiet
```

Expected application result for release 1.1.0:

```text
tests 13
pass 13
fail 0
```

The validator should also report that the workflow is inactive, critical
stages are present, Code-node JavaScript parses, and no known secret patterns
were detected.

## Local Simulator Stack

Create a local environment file and replace every placeholder:

```bash
cp .env.example .env
docker compose --profile mock-openai up -d
```

The simulator exposes an OpenAI Responses-compatible surface only to the
internal Docker network. It makes no OpenAI request and consumes no provider
credits. The production workflow export continues to reference the real
provider endpoint; generate a disposable test copy when changing endpoints for
local experiments.

Inspect service state and stop the stack with:

```bash
docker compose --profile mock-openai ps
docker compose --profile mock-openai down
```

Named volumes are preserved by the stop command. Deleting volumes is outside
this reproduction procedure because it is destructive.

## External Integration Reproduction

Google Sheets and Slack validation requires test accounts and credentials that
are intentionally absent from this repository. To reproduce it:

1. Create a non-production spreadsheet and a private test Slack channel.
2. Create least-privilege Google and Slack credentials in n8n.
3. Import `workflows/lead-qualification.json` and map credential references.
4. Configure the spreadsheet ID, sheet name, and Slack channel ID inside the
   workflow configuration node.
5. Keep the workflow inactive until the technical manual's acceptance checks
   pass.
6. Submit synthetic fixtures with the signing helper.
7. Record execution identifiers, timestamps, expected/observed outcomes, and
   any deviations without publishing secrets or account identifiers.

See the [technical integration manual](technical-integration-manual.md) for the
complete procedure.

## Evidence Classes

| Class | Meaning |
|---|---|
| Static | Derived from file structure or source inspection. |
| Deterministic | Repeatable tests or simulator behavior with fixed inputs. |
| Local live | Executed against local n8n/PostgreSQL containers. |
| External test | Executed through real non-production Google/Slack accounts. |
| Production | Real traffic and production providers; not included here. |

Results should always name their evidence class. Simulator output must never be
reported as live-model performance.

## Reproduction Record Template

```text
Commit:
Date/time and timezone:
Host OS:
Node / npm:
Docker / Compose:
n8n / PostgreSQL:
Commands executed:
Fixture IDs:
Expected results:
Observed results:
Evidence class:
Deviations:
```

## Known Sources of Variation

- container image updates if version pins are changed;
- provider API, OAuth, and workspace-policy changes;
- host timing during concurrent or timeout scenarios;
- n8n credential mappings and workflow import behavior;
- locale/timezone display differences;
- model version and nondeterminism in future real-model studies.

Preserve the commit hash, dependency versions, prompts, schema, fixtures, and
raw aggregate measurements for every reported experiment.
