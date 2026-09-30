#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(scriptDirectory, '..');
const sourcePath = path.join(workspace, 'workflows', 'lead-qualification.json');
const outputPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(workspace, 'tmp', 'lead-qualification.mock-test.json');

const workflow = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const configNode = workflow.nodes.find((node) => node.name === 'Add Runtime Configuration');
assert.ok(configNode, 'Add Runtime Configuration node is missing');
assert.match(configNode.parameters.jsCode, /openai_api_url: 'https:\/\/api\.openai\.com\/v1\/responses'/);
assert.match(configNode.parameters.jsCode, /openai_model: 'gpt-5\.6-luna'/);

const replaceConfigValue = (key, currentValue, nextValue) => {
  const current = `${key}: '${currentValue}'`;
  const replacement = `${key}: '${nextValue}'`;
  assert.ok(configNode.parameters.jsCode.includes(current), `Expected ${key} value is missing`);
  configNode.parameters.jsCode = configNode.parameters.jsCode.replace(current, replacement);
};

configNode.parameters.jsCode = configNode.parameters.jsCode
  .replace("openai_api_url: 'https://api.openai.com/v1/responses'", "openai_api_url: 'http://mock-openai:8080/v1/responses'")
  .replace("openai_model: 'gpt-5.6-luna'", "openai_model: 'mock-gpt-5.6-luna'");

const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID?.trim();
const sheetName = process.env.GOOGLE_SHEET_NAME?.trim();
const slackChannelId = process.env.SLACK_CHANNEL_ID?.trim();

if (spreadsheetId) {
  assert.match(spreadsheetId, /^[A-Za-z0-9_-]{20,100}$/, 'Invalid Google spreadsheet ID');
  replaceConfigValue('google_spreadsheet_id', 'REPLACE_WITH_SPREADSHEET_ID', spreadsheetId);
}
if (sheetName) {
  assert.match(sheetName, /^[A-Za-z0-9 _-]{1,100}$/, 'Invalid Google Sheet tab name');
  replaceConfigValue('google_sheet_name', 'Leads', sheetName);
}
if (slackChannelId) {
  assert.match(slackChannelId, /^[A-Z][A-Z0-9]{8,20}$/, 'Invalid Slack channel ID');
  replaceConfigValue('slack_channel_id', 'REPLACE_WITH_SLACK_CHANNEL_ID', slackChannelId);
}

const credentialIds = process.env.N8N_CREDENTIAL_IDS_JSON
  ? JSON.parse(process.env.N8N_CREDENTIAL_IDS_JSON)
  : {};
for (const node of workflow.nodes) {
  for (const credential of Object.values(node.credentials || {})) {
    const credentialId = credentialIds[credential.name];
    if (!credentialId) continue;
    assert.match(credentialId, /^[A-Za-z0-9_-]{6,64}$/, `Invalid credential ID for ${credential.name}`);
    credential.id = credentialId;
  }
}
configNode.notes = 'MOCK TEST ONLY. Calls the internal Docker simulator. It never calls OpenAI and must not be activated for production.';

workflow.id = 'AILeadQualMock202609';
workflow.name = 'AI Lead Qualification - MOCK TEST ONLY';
workflow.active = false;
workflow.tags = [];

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(workflow, null, 2)}\n`, { mode: 0o600 });
console.log(outputPath);
