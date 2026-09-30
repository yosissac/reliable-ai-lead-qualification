# Governance

The repository is maintained as an open engineering reference and research
artifact.

## Decision Process

- Small corrections and test additions may be accepted directly by a
  maintainer.
- Material changes to scoring, security boundaries, data handling, workflow
  state, or evidence claims should begin with an issue.
- Decisions should state alternatives, security/privacy effects, migration
  consequences, and how the change will be evaluated.
- Measured evidence, simulation, inference, and future work must remain clearly
  distinguished.

## Releases

A release should include:

- an inactive, credential-free workflow export;
- passing deterministic tests and workflow validation;
- updated change notes and behavior documentation;
- reviewed synthetic fixtures and publication assets;
- explicit known limitations and any migration steps.

Versioning follows semantic-versioning intent: incompatible configuration or
behavior changes require a major release; backward-compatible functionality a
minor release; corrections a patch release.

## Security and Conduct

Security reports follow [SECURITY.md](SECURITY.md). Community behavior follows
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Maintainers may decline changes that
weaken safety, reproducibility, evidence integrity, or project focus.
