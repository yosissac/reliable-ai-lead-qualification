#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import http from 'node:http';
import { pathToFileURL } from 'node:url';

const MAX_BODY_BYTES = 1_000_000;

const components = (values) => ({
  problem_clarity: values[0],
  business_impact: values[1],
  urgency: values[2],
  budget_readiness: values[3],
  contact_intent_and_fit: values[4],
});

const scenarios = {
  brightLogistics: {
    qualification: 'HOT',
    score: 96,
    category: 'AI_AUTOMATION',
    reason: 'Clear high-volume manual process, approved budget, and a near-term requirement.',
    recommended_action: 'CONTACT_SALES',
    is_relevant: true,
    score_components: components([20, 20, 18, 20, 18]),
  },
  exploratory: {
    qualification: 'COLD',
    score: 15,
    category: 'OTHER_RELEVANT',
    reason: 'General curiosity without a defined business problem, company, budget, or timeline.',
    recommended_action: 'NURTURE',
    is_relevant: true,
    score_components: components([8, 2, 1, 0, 4]),
  },
  hubspot: {
    qualification: 'HOT',
    score: 76,
    category: 'BUSINESS_SYSTEMS_INTEGRATION',
    reason: 'Clear manual CRM transfer problem and a request to discuss options next week.',
    recommended_action: 'CONTACT_SALES',
    is_relevant: true,
    score_components: components([20, 15, 18, 5, 18]),
  },
  supportEmails: {
    qualification: 'HOT',
    score: 86,
    category: 'AI_AUTOMATION',
    reason: 'Clear repetitive support workload, meaningful volume, and a near-term implementation need.',
    recommended_action: 'CONTACT_SALES',
    is_relevant: true,
    score_components: components([20, 20, 18, 10, 18]),
  },
  defaultRelevant: {
    qualification: 'WARM',
    score: 58,
    category: 'OTHER_RELEVANT',
    reason: 'A relevant business request is present, but buying readiness and urgency need confirmation.',
    recommended_action: 'MANUAL_REVIEW',
    is_relevant: true,
    score_components: components([15, 12, 10, 6, 15]),
  },
};

const falseHot = {
  qualification: 'HOT',
  score: 100,
  category: 'OTHER_RELEVANT',
  reason: 'Deliberately inconsistent mock output used to prove downstream guardrails.',
  recommended_action: 'CONTACT_SALES',
  is_relevant: false,
  score_components: components([0, 0, 0, 0, 0]),
};

function classify(inputLead) {
  const text = `${inputLead.service || ''}\n${inputLead.message || ''}`.toLowerCase();
  if (text.includes('[mock:false_hot]')) return structuredClone(falseHot);
  if (text.includes('2,000 delivery documents') || text.includes('2000 delivery documents')) return structuredClone(scenarios.brightLogistics);
  if (text.includes('just checking what ai is') || text.includes('maybe someday')) return structuredClone(scenarios.exploratory);
  if (text.includes('hubspot') && text.includes('next week')) return structuredClone(scenarios.hubspot);
  if (text.includes('700 customer emails') || text.includes('draft replies')) return structuredClone(scenarios.supportEmails);
  return structuredClone(scenarios.defaultRelevant);
}

function extractInputLead(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('request body must be an object');
  if (!body.text?.format || body.text.format.type !== 'json_schema' || body.text.format.strict !== true) {
    throw new Error('strict text.format JSON schema is required');
  }
  const userItem = Array.isArray(body.input) ? body.input.find((item) => item?.role === 'user') : null;
  const content = userItem?.content;
  const text = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.find((item) => item?.type === 'input_text')?.text
      : null;
  if (typeof text !== 'string') throw new Error('user input_text is required');
  const lead = JSON.parse(text);
  if (!lead || typeof lead !== 'object' || Array.isArray(lead)) throw new Error('user input_text must contain a JSON object');
  return lead;
}

function scenarioFor(message, seenCount) {
  const lower = message.toLowerCase();
  const statusMatch = lower.match(/\[mock:http_(400|401|403|408|429|500|502|503|504)\]/);
  if (statusMatch) return `http_${statusMatch[1]}`;
  if (lower.includes('[mock:fail_once]') && seenCount === 1) return 'fail_once_503';
  if (lower.includes('[mock:malformed_json]')) return 'malformed_json';
  if (lower.includes('[mock:wrong_schema]')) return 'wrong_schema';
  if (lower.includes('[mock:false_hot]')) return 'false_hot';
  return 'success';
}

function outputEnvelope(model, outputText) {
  return {
    id: `resp_mock_${randomUUID().replaceAll('-', '')}`,
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    status: 'completed',
    model: model || 'mock-gpt-5.6-luna',
    output: [{
      id: `msg_mock_${randomUUID().replaceAll('-', '')}`,
      type: 'message',
      status: 'completed',
      role: 'assistant',
      content: [{ type: 'output_text', annotations: [], text: outputText }],
    }],
    usage: { input_tokens: 100, output_tokens: 80, total_tokens: 180 },
  };
}

function sendJson(response, statusCode, body) {
  const encoded = JSON.stringify(body);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(encoded),
  });
  response.end(encoded);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('request body is too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createMockOpenAIServer() {
  const requestCounts = new Map();
  const scenarioCounts = new Map();

  return http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      return sendJson(response, 200, { status: 'ok', service: 'mock-openai', real_api_called: false });
    }
    if (request.method === 'GET' && request.url === '/__mock/stats') {
      return sendJson(response, 200, {
        total_requests: [...requestCounts.values()].reduce((sum, count) => sum + count, 0),
        unique_request_bodies: requestCounts.size,
        scenarios: Object.fromEntries([...scenarioCounts.entries()].sort()),
        real_api_called: false,
      });
    }
    if (request.method !== 'POST' || request.url !== '/v1/responses') {
      return sendJson(response, 404, { error: { message: 'mock endpoint not found', type: 'invalid_request_error' } });
    }
    if (!/^Bearer\s+\S+$/i.test(String(request.headers.authorization || ''))) {
      return sendJson(response, 401, { error: { message: 'Bearer authorization is required by the mock', type: 'authentication_error' } });
    }

    try {
      const body = await readJson(request);
      const lead = extractInputLead(body);
      const requestHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
      const seenCount = (requestCounts.get(requestHash) || 0) + 1;
      requestCounts.set(requestHash, seenCount);
      const scenario = scenarioFor(String(lead.message || ''), seenCount);
      scenarioCounts.set(scenario, (scenarioCounts.get(scenario) || 0) + 1);

      const delayMatch = String(lead.message || '').match(/\[mock:delay_ms=(\d{1,5})\]/i);
      if (delayMatch) await new Promise((resolve) => setTimeout(resolve, Math.min(Number(delayMatch[1]), 35_000)));

      if (scenario.startsWith('http_') || scenario === 'fail_once_503') {
        const statusCode = scenario === 'fail_once_503' ? 503 : Number(scenario.slice(5));
        const type = statusCode >= 500 ? 'server_error' : statusCode === 429 ? 'rate_limit_error' : 'invalid_request_error';
        return sendJson(response, statusCode, { error: { message: `Deliberate mock HTTP ${statusCode}`, type } });
      }
      if (scenario === 'malformed_json') {
        return sendJson(response, 200, outputEnvelope(body.model, '{not-valid-json'));
      }
      if (scenario === 'wrong_schema') {
        return sendJson(response, 200, outputEnvelope(body.model, JSON.stringify({ qualification: 'HOT', score: '100' })));
      }

      return sendJson(response, 200, outputEnvelope(body.model, JSON.stringify(classify(lead))));
    } catch (error) {
      return sendJson(response, 400, { error: { message: String(error.message || error), type: 'invalid_request_error' } });
    }
  });
}

const executedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (executedDirectly) {
  const port = Number(process.env.MOCK_OPENAI_PORT || 8080);
  const server = createMockOpenAIServer();
  server.listen(port, '0.0.0.0', () => {
    console.log(`Mock OpenAI listening internally on port ${port}; no real API will be called`);
  });
}
