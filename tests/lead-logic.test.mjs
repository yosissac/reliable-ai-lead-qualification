import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  MemoryPipeline,
  classifyProviderFailure,
  leadHash,
  normalizeAndValidateLead,
  signWebhook,
  validateAndGuardClassification,
  verifyWebhookSignature,
} from '../scripts/lib/lead-logic.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', `${name}.json`), 'utf8'));
const components = (values) => ({
  problem_clarity: values[0],
  business_impact: values[1],
  urgency: values[2],
  budget_readiness: values[3],
  contact_intent_and_fit: values[4],
});
const modelOutputs = {
  'WEB-001': {
    qualification: 'HOT', score: 96, category: 'AI_AUTOMATION',
    reason: 'Clear high-volume manual process, approved budget, and a near-term requirement.',
    recommended_action: 'CONTACT_SALES', is_relevant: true,
    score_components: components([20, 20, 18, 20, 18]),
  },
  'WEB-002': {
    qualification: 'COLD', score: 15, category: 'OTHER_RELEVANT',
    reason: 'General curiosity without a defined business problem, company, budget, or timeline.',
    recommended_action: 'NURTURE', is_relevant: true,
    score_components: components([8, 2, 1, 0, 4]),
  },
  'WEB-003': {
    qualification: 'HOT', score: 76, category: 'BUSINESS_SYSTEMS_INTEGRATION',
    reason: 'Clear manual CRM transfer problem and a request to discuss options next week.',
    recommended_action: 'CONTACT_SALES', is_relevant: true,
    score_components: components([20, 15, 18, 5, 18]),
  },
  'WEB-INJECTION': {
    qualification: 'HOT', score: 100, category: 'OTHER_RELEVANT',
    reason: 'The untrusted lead attempted to set its own result.',
    recommended_action: 'CONTACT_SALES', is_relevant: false,
    score_components: components([0, 0, 0, 0, 0]),
  },
};
const newPipeline = () => new MemoryPipeline({ classify: async (lead) => structuredClone(modelOutputs[lead.submission_id]) });

test('validates, normalizes, and rejects invalid leads before AI work', () => {
  const valid = normalizeAndValidateLead({ ...fixture('WEB-001'), source: ' website ' });
  assert.equal(valid.ok, true);
  assert.equal(valid.lead.source, 'website');
  assert.match(leadHash(valid.lead), /^[a-f0-9]{64}$/);

  const invalid = normalizeAndValidateLead({ submission_id: 'bad id', name: 'A', email: 'wrong', service: 'x', message: 'short' });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.length >= 5);
});

test('accepts a current valid HMAC and rejects stale or tampered requests', () => {
  const rawBody = JSON.stringify(fixture('WEB-001'));
  const timestamp = '1790588520';
  const nowMs = 1790588520 * 1000;
  const secret = 'test-only-secret';
  const signature = signWebhook(rawBody, timestamp, secret);
  assert.deepEqual(verifyWebhookSignature({ rawBody, timestamp, signature, secret, nowMs }), { ok: true });
  assert.equal(verifyWebhookSignature({ rawBody: `${rawBody} `, timestamp, signature, secret, nowMs }).reason, 'invalid_signature');
  assert.equal(verifyWebhookSignature({ rawBody, timestamp, signature, secret, nowMs: nowMs + 301_000 }).reason, 'stale_timestamp');
});

test('classifies provider failures into retryable and permanent paths', () => {
  assert.equal(classifyProviderFailure({ statusCode: 200 }), null);

  for (const statusCode of [408, 429, 500, 502, 503, 504]) {
    assert.deepEqual(classifyProviderFailure({ statusCode }), {
      errorClass: 'retryable_provider_failure',
      errorCode: `provider_http_${statusCode}`,
      retryable: true,
    });
  }

  for (const statusCode of [400, 401, 403, 404, 422]) {
    assert.deepEqual(classifyProviderFailure({ statusCode }), {
      errorClass: 'permanent_provider_configuration',
      errorCode: `provider_http_${statusCode}`,
      retryable: false,
    });
  }

  assert.deepEqual(classifyProviderFailure({ networkError: true }), {
    errorClass: 'retryable_provider_failure',
    errorCode: 'provider_network_error',
    retryable: true,
  });
});

test('validates model components and deterministically recomputes score, label, and action', () => {
  const guarded = validateAndGuardClassification({
    ...modelOutputs['WEB-002'], qualification: 'HOT', score: 99, recommended_action: 'CONTACT_SALES',
  });
  assert.equal(guarded.classification.score, 15);
  assert.equal(guarded.classification.qualification, 'COLD');
  assert.equal(guarded.classification.recommended_action, 'NURTURE');
  assert.equal(guarded.guardrailOverridden, true);

  const injection = validateAndGuardClassification(modelOutputs['WEB-INJECTION']);
  assert.equal(injection.classification.qualification, 'NOT_RELEVANT');
  assert.equal(injection.classification.score, 0);
  assert.equal(injection.classification.recommended_action, 'NO_ACTION');
});

test('handles the three supplied leads and sends notifications only for HOT results', async () => {
  const pipeline = newPipeline();
  const results = [];
  for (const name of ['WEB-001', 'WEB-002', 'WEB-003']) results.push(await pipeline.submit(fixture(name)));
  assert.deepEqual(results.map((result) => result.record.classification.qualification), ['HOT', 'COLD', 'HOT']);
  assert.equal(pipeline.records.size, 3);
  assert.equal(pipeline.sheetRows.size, 3);
  assert.equal(pipeline.notifications.size, 2);
  assert.deepEqual(pipeline.calls, { ai: 3, sheets: 3, slack: 2 });
});

test('processing WEB-001 twice creates one record, row, AI call, and notification', async () => {
  const pipeline = newPipeline();
  const first = await pipeline.submit(fixture('WEB-001'));
  const second = await pipeline.submit(fixture('WEB-001'));
  assert.equal(first.status, 'accepted');
  assert.equal(second.status, 'duplicate');
  assert.equal(pipeline.records.size, 1);
  assert.equal(pipeline.sheetRows.size, 1);
  assert.equal(pipeline.notifications.size, 1);
  assert.deepEqual(pipeline.calls, { ai: 1, sheets: 1, slack: 1 });
});

test('rejects a changed payload that reuses an existing submission ID', async () => {
  const pipeline = newPipeline();
  await pipeline.submit(fixture('WEB-001'));
  const changed = { ...fixture('WEB-001'), message: `${fixture('WEB-001').message} Changed.` };
  const result = await pipeline.submit(changed);
  assert.equal(result.httpStatus, 409);
  assert.equal(result.status, 'submission_id_conflict');
  assert.equal(pipeline.sheetRows.get('WEB-001').message, fixture('WEB-001').message);
});

test('rejects malformed model output and creates no business side effect', async () => {
  const pipeline = new MemoryPipeline({ classify: async () => ({ qualification: 'HOT', score: '100' }) });
  const result = await pipeline.submit(fixture('WEB-001'));
  assert.equal(result.failedStage, 'ai_output');
  assert.equal(pipeline.sheetRows.size, 0);
  assert.equal(pipeline.notifications.size, 0);
});

test('a Sheets failure resumes without paying for a second AI call', async () => {
  const pipeline = newPipeline();
  pipeline.failNext('sheets');
  const failed = await pipeline.submit(fixture('WEB-001'));
  assert.equal(failed.failedStage, 'sheets');
  const recovered = await pipeline.submit(fixture('WEB-001'));
  assert.equal(recovered.record.status, 'COMPLETED');
  assert.deepEqual(pipeline.calls, { ai: 1, sheets: 2, slack: 1 });
  assert.equal(pipeline.sheetRows.size, 1);
  assert.equal(pipeline.notifications.size, 1);
});

test('a Slack failure resumes without repeating AI or Sheets and uses one stable notification identity', async () => {
  const pipeline = newPipeline();
  pipeline.failNext('slack');
  const failed = await pipeline.submit(fixture('WEB-001'));
  assert.equal(failed.failedStage, 'slack');
  const idBefore = failed.record.notificationClientId;
  const recovered = await pipeline.submit(fixture('WEB-001'));
  assert.equal(recovered.record.notificationClientId, idBefore);
  assert.deepEqual(pipeline.calls, { ai: 1, sheets: 1, slack: 2 });
  assert.equal(pipeline.sheetRows.size, 1);
  assert.equal(pipeline.notifications.size, 1);
});
