# User Manual

## AI Lead Qualification Automation

**Audience:** sales, operations, marketing, and business administrators

## What the System Does

When a visitor submits the connected website form, the system checks the data,
prevents duplicate processing, evaluates the business need, records the lead in
Google Sheets, and sends Slack an alert when the final result is HOT.

It does not automatically contact the prospect. A team member remains
responsible for reviewing the lead and taking the appropriate next action.

## Qualification Labels

| Label | Meaning | Recommended team action |
|---|---|---|
| HOT | Strong, relevant opportunity with a high combined score | Contact sales promptly |
| WARM | Relevant opportunity that needs human review | Review context, verify fit, and decide follow-up |
| COLD | Relevant but early, vague, or low-readiness inquiry | Nurture or defer according to policy |
| NOT_RELEVANT | Not a relevant business opportunity | No sales action unless manually overridden by policy |

The model supplies structured evidence and bounded component scores. The system
validates them and calculates the final total, label, and action consistently.

## Google Sheet

The Sheet is the team's working register. Each `submission_id` should represent
one website submission. Important columns include contact details, service,
message, qualification, score, category, reason, recommended action, model, and
processing status.

Do not:

- change the tab name or required headers without an approved workflow update;
- reuse a submission ID for a different lead;
- delete failed rows or processing records to force a retry;
- store secrets or private internal notes in fields exposed to automation.

You may sort, filter, and create separate reporting views. Protect the original
automation columns from accidental edits where practical.

## Slack Alerts

Only HOT leads generate a Slack alert. The alert should provide enough context
for a salesperson to find the matching Sheet row and decide what to do next.

No Slack alert for a WARM or COLD lead is normal. If a HOT row exists without an
alert, report the submission ID to the automation owner; do not resubmit the
lead with a new ID unless instructed.

## Daily Operating Routine

1. Review new HOT alerts and assign an owner.
2. Review WARM rows that require a human decision.
3. Check for failed or manual-review statuses.
4. Confirm that expected website volume appears in the Sheet.
5. Report unusual duplicates, missing fields, or clearly incorrect assessments.

## Duplicate and Conflict Messages

- `duplicate`: the same completed submission was received again; no action is
  normally required.
- `already_processing`: work is still in progress; wait for completion.
- `submission_id_conflict`: different data reused an existing ID; the website
  integration owner must investigate.
- `manual_review_required`: automatic processing stopped and a technical owner
  must inspect the failure.

## What To Do When Something Fails

| Symptom | Business-user action |
|---|---|
| Lead missing from Sheet | Note the submission ID and time; contact the automation owner |
| HOT row but no Slack alert | Share the submission ID; do not create a replacement lead |
| Repeated Slack alert | Preserve both message timestamps and report them |
| Obviously wrong qualification | Mark for human review and provide the reasoning; do not edit system columns as a hidden correction |
| Google or Slack access prompt | Do not enter credentials sent through chat; ask the authorized account owner |
| `manual_review_required` | Escalate to the technical owner with the submission ID only |

Never send passwords, API keys, OAuth secrets, bot tokens, authentication codes,
or full authorization headers in Slack, email, screenshots, or support tickets.

## Human Review and Overrides

Automation prioritizes work; it does not replace business judgment. If the team
overrides a qualification, record the new decision in a dedicated human-review
field, along with the reviewer and reason. Do not overwrite the original model
result because it is useful for audits and future calibration.

Collect examples of clearly good and bad classifications. Periodic review of a
representative sample is the correct way to tune thresholds and instructions.

## Privacy

Use the Sheet and Slack channel only for authorized business purposes. Restrict
access to staff who need the lead data, follow the organization's retention and
deletion policy, and avoid copying lead details to unapproved systems.

The model request is designed to minimize direct personal data, but the Sheet
still contains the original form submission and must be handled accordingly.

## Support Information To Provide

When reporting a problem, provide:

- submission ID;
- approximate submission time and timezone;
- visible status or response code;
- which expected result is missing;
- a sanitized screenshot if useful.

Do not include secrets. The technical owner can use the submission ID to inspect
the durable processing history.
