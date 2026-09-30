# Contributing

Contributions that improve correctness, reproducibility, documentation, or
provider compatibility are welcome.

## Before Opening a Pull Request

1. Open an issue for material architecture or behavior changes.
2. Use synthetic data only.
3. Never commit credentials, authorization headers, OAuth material, private
   execution exports, customer data, spreadsheet IDs, or channel IDs.
4. Add or update tests for behavior changes.
5. Preserve the distinction between live, simulated, and unproven evidence.
6. Run:

```bash
npm run check
bash -n db/init/001_lead_automation.sh
POSTGRES_PASSWORD=test-owner-password \
LEAD_DB_PASSWORD=test-app-password \
N8N_ENCRYPTION_KEY=test-only-encryption-key-at-least-32-chars \
docker compose config --quiet
```

## Pull Request Expectations

- Explain the problem and the behavioral change.
- State security, privacy, cost, and migration effects.
- Include deterministic reproduction steps.
- Identify any evidence that remains simulated or environment-dependent.
- Keep workflow exports inactive and free of embedded secrets.

By contributing, you agree that your contribution is licensed under the MIT
License.
