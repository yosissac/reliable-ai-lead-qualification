import crypto from 'node:crypto';

const REQUIRED_FIELDS = ['submission_id', 'name', 'email', 'service', 'message'];
const STRING_LIMITS = {
  submission_id: 64,
  name: 100,
  email: 254,
  company: 150,
  phone: 40,
  service: 100,
  message: 3000,
  source: 50,
  submitted_at: 40,
};
const ALLOWED_QUALIFICATIONS = new Set(['HOT', 'WARM', 'COLD', 'NOT_RELEVANT']);
const ALLOWED_CATEGORIES = new Set([
  'AI_AUTOMATION',
  'BUSINESS_SYSTEMS_INTEGRATION',
  'CLOUD_INFRASTRUCTURE',
  'API_INTEGRATION',
  'OTHER_RELEVANT',
  'NOT_RELEVANT',
]);
const COMPONENTS = [
  'problem_clarity',
  'business_impact',
  'urgency',
  'budget_readiness',
  'contact_intent_and_fit',
];

function cleanString(value) {
  return value.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

export function normalizeAndValidateLead(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['body must be a JSON object'] };
  }

  const errors = [];
  const lead = {};
  for (const [field, limit] of Object.entries(STRING_LIMITS)) {
    const value = input[field];
    if (value === undefined || value === null) {
      lead[field] = field === 'source' ? 'website' : '';
      continue;
    }
    if (typeof value !== 'string') {
      errors.push(`${field} must be a string`);
      lead[field] = '';
      continue;
    }
    lead[field] = cleanString(value);
    if (lead[field].length > limit) errors.push(`${field} must not exceed ${limit} characters`);
  }

  for (const field of REQUIRED_FIELDS) {
    if (!lead[field]) errors.push(`${field} is required`);
  }
  if (lead.name && lead.name.length < 2) errors.push('name must contain at least 2 characters');
  if (lead.service && lead.service.length < 2) errors.push('service must contain at least 2 characters');
  if (lead.message && lead.message.length < 20) errors.push('message must contain at least 20 characters');
  if (lead.submission_id && !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(lead.submission_id)) {
    errors.push('submission_id contains unsupported characters');
  }
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    errors.push('email is not valid');
  }
  if (lead.submitted_at && Number.isNaN(Date.parse(lead.submitted_at))) {
    errors.push('submitted_at must be an ISO date when provided');
  }

  return errors.length ? { ok: false, errors } : { ok: true, lead };
}

export function canonicalLead(lead) {
  return JSON.stringify(Object.fromEntries(Object.keys(STRING_LIMITS).sort().map((key) => [key, lead[key] ?? ''])));
}

export function leadHash(lead) {
  return crypto.createHash('sha256').update(canonicalLead(lead)).digest('hex');
}

export function signWebhook(rawBody, timestamp, secret) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

export function verifyWebhookSignature({ rawBody, timestamp, signature, secret, nowMs = Date.now(), toleranceSeconds = 300 }) {
  if (!rawBody || !timestamp || !signature || !secret) return { ok: false, reason: 'missing_signature_data' };
  const timestampMs = Number.isFinite(Number(timestamp)) && String(timestamp).length <= 10
    ? Number(timestamp) * 1000
    : Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) return { ok: false, reason: 'invalid_timestamp' };
  if (Math.abs(nowMs - timestampMs) > toleranceSeconds * 1000) return { ok: false, reason: 'stale_timestamp' };

  const expected = signWebhook(rawBody, timestamp, secret);
  const provided = String(signature).replace(/^sha256=/i, '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(provided)) return { ok: false, reason: 'invalid_signature' };
  const valid = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  return valid ? { ok: true } : { ok: false, reason: 'invalid_signature' };
}

export function classifyProviderFailure({ networkError = false, statusCode = 200 } = {}) {
  if (networkError) {
    return {
      errorClass: 'retryable_provider_failure',
      errorCode: 'provider_network_error',
      retryable: true,
    };
  }

  const status = Number(statusCode);
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    return {
      errorClass: 'permanent_provider_configuration',
      errorCode: 'provider_invalid_status',
      retryable: false,
    };
  }
  if ((status >= 200 && status < 300)) return null;
  if (status === 408 || status === 429 || status >= 500) {
    return {
      errorClass: 'retryable_provider_failure',
      errorCode: `provider_http_${status}`,
      retryable: true,
    };
  }
  if (status >= 400 && status < 500) {
    return {
      errorClass: 'permanent_provider_configuration',
      errorCode: `provider_http_${status}`,
      retryable: false,
    };
  }
  return {
    errorClass: 'permanent_provider_configuration',
    errorCode: `provider_http_${status}`,
    retryable: false,
  };
}

export function validateAndGuardClassification(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) throw new Error('AI output must be an object');
  if (!ALLOWED_QUALIFICATIONS.has(output.qualification)) throw new Error('AI qualification is invalid');
  if (!ALLOWED_CATEGORIES.has(output.category)) throw new Error('AI category is invalid');
  if (typeof output.is_relevant !== 'boolean') throw new Error('AI is_relevant must be boolean');
  if (!output.score_components || typeof output.score_components !== 'object') throw new Error('AI score_components is missing');

  for (const component of COMPONENTS) {
    const value = output.score_components[component];
    if (!Number.isInteger(value) || value < 0 || value > 20) {
      throw new Error(`AI component ${component} must be an integer from 0 to 20`);
    }
  }
  const reason = typeof output.reason === 'string' ? output.reason.trim().slice(0, 500) : '';
  if (!reason) throw new Error('AI reason is missing');

  const score = COMPONENTS.reduce((sum, component) => sum + output.score_components[component], 0);
  const qualification = !output.is_relevant ? 'NOT_RELEVANT' : score >= 75 ? 'HOT' : score >= 50 ? 'WARM' : 'COLD';
  const actions = { HOT: 'CONTACT_SALES', WARM: 'MANUAL_REVIEW', COLD: 'NURTURE', NOT_RELEVANT: 'NO_ACTION' };
  const category = output.is_relevant
    ? (output.category === 'NOT_RELEVANT' ? 'OTHER_RELEVANT' : output.category)
    : 'NOT_RELEVANT';
  const guarded = {
    qualification,
    score,
    category,
    reason,
    recommended_action: actions[qualification],
    is_relevant: output.is_relevant,
    score_components: structuredClone(output.score_components),
  };
  return {
    classification: guarded,
    guardrailOverridden: output.score !== score
      || output.qualification !== qualification
      || output.recommended_action !== actions[qualification]
      || output.category !== category,
  };
}

export class MemoryPipeline {
  constructor({ classify }) {
    this.classify = classify;
    this.records = new Map();
    this.sheetRows = new Map();
    this.notifications = new Map();
    this.calls = { ai: 0, sheets: 0, slack: 0 };
    this.failures = new Map();
  }

  failNext(stage, count = 1) {
    this.failures.set(stage, (this.failures.get(stage) || 0) + count);
  }

  shouldFail(stage) {
    const left = this.failures.get(stage) || 0;
    if (!left) return false;
    this.failures.set(stage, left - 1);
    return true;
  }

  async submit(input) {
    const checked = normalizeAndValidateLead(input);
    if (!checked.ok) return { httpStatus: 400, status: 'invalid', errors: checked.errors };
    const hash = leadHash(checked.lead);
    let record = this.records.get(checked.lead.submission_id);
    if (record && record.payloadHash !== hash) return { httpStatus: 409, status: 'submission_id_conflict' };
    if (record?.status === 'COMPLETED') return { httpStatus: 200, status: 'duplicate', record };
    if (!record) {
      record = {
        submissionId: checked.lead.submission_id,
        payloadHash: hash,
        lead: checked.lead,
        status: 'RECEIVED',
        notificationClientId: crypto.randomUUID(),
      };
      this.records.set(record.submissionId, record);
    }
    return this.process(record);
  }

  async process(record) {
    if (!record.classification) {
      this.calls.ai += 1;
      if (this.shouldFail('ai')) {
        record.status = 'FAILED_LLM';
        return { httpStatus: 202, status: 'retry_scheduled', failedStage: 'ai', record };
      }
      try {
        const output = await this.classify(record.lead);
        const guarded = validateAndGuardClassification(output);
        record.classification = guarded.classification;
        record.guardrailOverridden = guarded.guardrailOverridden;
        record.status = 'CLASSIFIED';
      } catch (error) {
        record.status = 'FAILED_LLM_OUTPUT';
        record.lastError = error.message;
        return { httpStatus: 202, status: 'retry_scheduled', failedStage: 'ai_output', record };
      }
    }

    if (!record.sheetWritten) {
      this.calls.sheets += 1;
      if (this.shouldFail('sheets')) {
        record.status = 'FAILED_SHEETS';
        return { httpStatus: 202, status: 'retry_scheduled', failedStage: 'sheets', record };
      }
      this.sheetRows.set(record.submissionId, { ...record.lead, ...record.classification });
      record.sheetWritten = true;
      record.status = 'SHEET_WRITTEN';
    }

    if (record.classification.qualification === 'HOT' && !record.notificationSent) {
      this.calls.slack += 1;
      if (this.shouldFail('slack')) {
        record.status = 'FAILED_NOTIFICATION';
        return { httpStatus: 202, status: 'retry_scheduled', failedStage: 'slack', record };
      }
      this.notifications.set(record.notificationClientId, {
        submissionId: record.submissionId,
        score: record.classification.score,
      });
      record.notificationSent = true;
    }

    record.status = 'COMPLETED';
    return { httpStatus: 202, status: 'accepted', record };
  }
}
