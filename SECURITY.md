# Security Policy

## Supported Version

Security fixes target the latest release on the default branch.

## Reporting a Vulnerability

Do not open a public issue containing an exploitable vulnerability, credential,
token, personal data, or private execution export. Use GitHub's private
vulnerability-reporting feature when it is enabled for this repository.

Include:

- affected version and component;
- reproduction steps using synthetic data;
- impact and plausible attack path;
- suggested mitigation if available.

## Deployment Responsibility

The repository ships an inactive workflow and local-development Compose file.
Operators remain responsible for TLS, ingress authentication, rate limits,
network isolation, credential scopes, patching, backups, retention, monitoring,
and incident response.

Never expose the n8n editor directly to the public internet or place the HMAC
secret in browser-side code.
