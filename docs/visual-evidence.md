# Evidence and Visual Provenance

## Publication Standard

The repository distinguishes implementation evidence from marketing claims.
All displayed leads are synthetic test records. Secrets, account identifiers,
credential values, and private customer data are excluded.

## Visual Inventory

| File | What it shows | Evidence class | SHA-256 |
|---|---|---|---|
| `assets/01-n8n-workflow-canvas.png` | The complete 41-node workflow topology. | Local implementation | `b86a1b38f54b2f409fbdd5435b3c7b63436abf4828255be9fff7f6886c1cd59f` |
| `assets/02-n8n-successful-hot-execution-simulator.png` | A successful HOT-path n8n execution using the local provider simulator. | Local live + deterministic simulator | `f8fcced7e7cfde935d9589bf95fe6580916ecc86cf13d17f4c6a85891e79f6dc` |
| `assets/03-google-sheets-results.png` | HOT, WARM, COLD, and not-relevant synthetic records written to a real test spreadsheet. | External test integration | `9f5d940ce3f000974dc6ef5c703fc4fece248f4e050d076c8e3e9905b9a8283e` |
| `assets/04-slack-hot-alert-privacy-edited.png` | HOT-only notifications in a real test Slack workspace. | External test integration; privacy-edited | `85f63411379027b85fd1e28054d4473bdcf219b4d0a65ada9701da6d473a7d01` |

## Image Processing Disclosure

- The workflow and execution images are captures from the local n8n test
  environment.
- The Sheets publication image uses a deterministic exact-pixel crop and
  composition from the original capture. It was not regenerated and its cells
  were not rewritten.
- The Slack publication image was privacy-edited to remove non-project account
  details while preserving the automation result being demonstrated.
- Original private captures are intentionally not part of the public
  repository.

Image edits are disclosure and privacy controls, not additional experimental
evidence.

## Supporting Reports

The [`../evidence/`](../evidence/) directory contains sanitized reports for:

- automated workflow validation and behavior tests;
- live local container execution;
- deterministic zero-cost simulator execution;
- provider error-taxonomy validation;
- real Google Sheets and Slack test integration acceptance.

These reports should be read with the claim boundaries in
[Research and Evaluation](research-and-evaluation.md). No report establishes
live-model predictive accuracy or a production service-level objective.

## Verification

From the repository root:

```bash
sha256sum assets/*.png evidence/*.md workflows/lead-qualification.json
npm run check
```

Hash values establish file identity only. They do not independently establish
the truth of the visual content.
