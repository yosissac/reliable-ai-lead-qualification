#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = new URL('../workflows/lead-qualification.json', import.meta.url);
const raw = fs.readFileSync(file, 'utf8');
const databaseInit = fs.readFileSync(new URL('../db/init/001_lead_automation.sh', import.meta.url), 'utf8');
const workflow = JSON.parse(raw);
const names = workflow.nodes.map((node) => node.name);
const nameSet = new Set(names);

assert.equal(workflow.active, false, 'delivered workflow must be inactive');
assert.match(workflow.id, /^[A-Za-z0-9_-]{8,36}$/, 'workflow must have a stable import ID');
assert.equal(nameSet.size, names.length, 'node names must be unique');
assert.ok(names.includes('Receive Lead'), 'webhook node is required');
assert.ok(names.includes('Verify and Validate Request'), 'validation node is required');
assert.ok(names.includes('Claim Submission Atomically'), 'atomic duplicate claim is required');
assert.ok(names.includes('Validate and Guard AI Result'), 'AI output guard is required');
assert.ok(names.includes('Upsert Google Sheets Lead'), 'Sheets upsert is required');
assert.ok(names.includes('Send Slack HOT Alert'), 'HOT notification is required');
assert.ok(names.includes('Recovery Every Five Minutes'), 'recovery trigger is required');

for (const [source, kinds] of Object.entries(workflow.connections || {})) {
  assert.ok(nameSet.has(source), `connection source does not exist: ${source}`);
  for (const lanes of Object.values(kinds)) {
    for (const lane of lanes) {
      for (const edge of lane) assert.ok(nameSet.has(edge.node), `connection target does not exist: ${edge.node}`);
    }
  }
}

for (const codeNode of workflow.nodes.filter((candidate) => candidate.type === 'n8n-nodes-base.code')) {
  try {
    // The Function wrapper permits the top-level return used by n8n Code nodes.
    new Function(codeNode.parameters.jsCode);
  } catch (error) {
    throw new Error(`invalid JavaScript in Code node ${codeNode.name}: ${error.message}`);
  }
}

const credentialNames = workflow.nodes.flatMap((node) => Object.values(node.credentials || {}).map((value) => value.name));
assert.ok(credentialNames.length >= 5, 'credential placeholders are expected');
for (const name of credentialNames) assert.match(name, /Website|Postgres|OpenAI|Google Sheets|Slack/, `unexpected credential: ${name}`);

const suspiciousSecrets = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AIza[0-9A-Za-z_-]{30,}/,
];
for (const pattern of suspiciousSecrets) assert.equal(pattern.test(raw), false, `possible embedded secret matching ${pattern}`);

const node = (name) => workflow.nodes.find((candidate) => candidate.name === name);
assert.match(node('Claim Submission Atomically').parameters.query, /ON CONFLICT/);
assert.match(node('Claim Submission Atomically').parameters.query, /payload_hash/);
assert.equal(node('Calculate Request HMAC').parameters.dataPropertyName, 'calculated_signature');
assert.equal(node('Hash Normalized Lead').parameters.dataPropertyName, 'payload_hash');
assert.match(node('Restore Signed Request Context').parameters.jsCode, /Extract Raw Body/);
assert.match(node('Normalize Payload Hash').parameters.jsCode, /payload_hash/);
assert.match(node('Validate and Guard AI Result').parameters.jsCode, /total >= 75/);
assert.match(node('Validate and Guard AI Result').parameters.jsCode, /total >= 50/);
assert.match(node('Validate and Guard AI Result').parameters.jsCode, /typeof modelOutput\.is_relevant !== 'boolean'/);
assert.match(node('Validate and Guard AI Result').parameters.jsCode, /!relevant \? 'NOT_RELEVANT'/);
assert.match(node('Validate and Guard AI Result').parameters.jsCode, /statusCode === 408/);
assert.match(node('Validate and Guard AI Result').parameters.jsCode, /statusCode === 429/);
assert.match(node('Validate and Guard AI Result').parameters.jsCode, /permanent_provider_configuration/);
assert.match(node('Validate and Guard AI Result').parameters.jsCode, /invalid_structured_output/);
assert.match(node('Record AI Failure').parameters.query, /THEN 'FAILED_PERMANENT'/);
assert.match(node('Record AI Failure').parameters.query, /WHEN COALESCE\(\(i\.d->>'retryable'\)::boolean, false\)/);
assert.match(node('Acquire Recoverable Leads').parameters.query, /status = 'FAILED_LLM_OUTPUT' AND next_retry_at IS NOT NULL/);
assert.match(databaseInit, /'FAILED_LLM_OUTPUT', 'FAILED_PERMANENT'\)/);
assert.match(node('Prepare Strict AI Request').parameters.jsCode, /additionalProperties: false/);
assert.doesNotMatch(node('Prepare Strict AI Request').parameters.jsCode, /lead\.phone|lead\.name/);
assert.match(node('Add Runtime Configuration').parameters.jsCode, /openai_api_url: 'https:\/\/api\.openai\.com\/v1\/responses'/);
assert.equal(node('Call OpenAI Structured Output').parameters.url, '={{ $json.config.openai_api_url }}');
assert.match(node('Send Slack HOT Alert').parameters.jsonBody, /client_msg_id/);
assert.match(node('Prepare Sheet Row').parameters.jsCode, /\^\[=\+\\-@\]/, 'Sheet-bound untrusted text must neutralize formula prefixes');
assert.match(node('Determine Notification Stage').parameters.jsCode, /&lt;/, 'Slack-bound untrusted text must escape mrkdwn control characters');
assert.match(node('Send Slack HOT Alert').parameters.jsonBody, /notification_text/);
assert.match(node('Upsert Google Sheets Lead').parameters.operation, /appendOrUpdate/);

console.log(`PASS: ${workflow.name}`);
console.log(`PASS: ${workflow.nodes.length} nodes, ${Object.keys(workflow.connections).length} connected sources, Code-node JavaScript parses`);
console.log(`PASS: inactive export, credential references only, no known secret patterns`);
console.log('PASS: validation, atomic claim, structured-output guard, Sheets upsert, Slack idempotency, and recovery are present');
