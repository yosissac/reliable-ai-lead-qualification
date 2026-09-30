import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockOpenAIServer } from '../mock-services/openai/mock-openai.mjs';

const strictRequest = (message) => ({
  model: 'mock-gpt-5.6-luna',
  input: [
    { role: 'system', content: [{ type: 'input_text', text: 'Return strict lead JSON.' }] },
    { role: 'user', content: [{ type: 'input_text', text: JSON.stringify({ service: 'Automation', message, company_provided: true, business_email: true }) }] },
  ],
  text: { format: { type: 'json_schema', name: 'lead_qualification', strict: true, schema: { type: 'object' } } },
});

async function withServer(run) {
  const server = createMockOpenAIServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function call(baseUrl, body, authorized = true) {
  const response = await fetch(`${baseUrl}/v1/responses`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorized ? { authorization: 'Bearer test-only-mock' } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const output = (responseBody) => JSON.parse(responseBody.output[0].content[0].text);

test('mock requires a Bearer credential and a strict schema request', async () => {
  await withServer(async (baseUrl) => {
    assert.equal((await call(baseUrl, strictRequest('A sufficiently long business request.'), false)).status, 401);
    const nonStrict = strictRequest('A sufficiently long business request.');
    nonStrict.text.format.strict = false;
    assert.equal((await call(baseUrl, nonStrict)).status, 400);
  });
});

test('mock returns deterministic Responses API-shaped results for supplied leads', async () => {
  await withServer(async (baseUrl) => {
    const hot = await call(baseUrl, strictRequest('We process about 2,000 delivery documents every month manually. Budget is approved.'));
    const cold = await call(baseUrl, strictRequest('Just checking what AI is. Maybe someday I will use it.'));
    const crm = await call(baseUrl, strictRequest('We manually transfer leads into HubSpot. Can somebody discuss options next week?'));
    assert.equal(hot.status, 200);
    assert.equal(output(hot.body).qualification, 'HOT');
    assert.equal(output(hot.body).score, 96);
    assert.equal(output(cold.body).qualification, 'COLD');
    assert.equal(output(cold.body).score, 15);
    assert.equal(output(crm.body).qualification, 'HOT');
    assert.equal(output(crm.body).score, 76);
  });
});

test('mock deliberately reproduces outage, malformed, wrong-schema, and fail-once behavior', async () => {
  await withServer(async (baseUrl) => {
    assert.equal((await call(baseUrl, strictRequest('Valid message [MOCK:HTTP_503]'))).status, 503);
    for (const statusCode of [400, 401, 403, 408, 429, 502, 504]) {
      assert.equal(
        (await call(baseUrl, strictRequest(`Valid message [MOCK:HTTP_${statusCode}]`))).status,
        statusCode,
      );
    }

    const malformed = await call(baseUrl, strictRequest('Valid message [MOCK:MALFORMED_JSON]'));
    assert.equal(malformed.status, 200);
    assert.throws(() => JSON.parse(malformed.body.output[0].content[0].text));

    const wrong = await call(baseUrl, strictRequest('Valid message [MOCK:WRONG_SCHEMA]'));
    assert.equal(typeof output(wrong.body).score, 'string');

    const failOnceBody = strictRequest('Valid message [MOCK:FAIL_ONCE]');
    assert.equal((await call(baseUrl, failOnceBody)).status, 503);
    assert.equal((await call(baseUrl, failOnceBody)).status, 200);

    const statsResponse = await fetch(`${baseUrl}/__mock/stats`);
    const stats = await statsResponse.json();
    assert.equal(stats.real_api_called, false);
    assert.equal(stats.total_requests, 12);
  });
});
