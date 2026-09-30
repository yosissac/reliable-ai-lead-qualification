#!/usr/bin/env node
import fs from 'node:fs';
import { signWebhook } from './lib/lead-logic.mjs';

const [file] = process.argv.slice(2);
const url = process.env.WEBHOOK_URL || 'http://127.0.0.1:5678/webhook/lead-qualification';
const key = process.env.WEBHOOK_KEY;
const secret = process.env.WEBHOOK_HMAC_SECRET;

if (!file || !key || !secret) {
  console.error('Usage: WEBHOOK_KEY="test key" WEBHOOK_HMAC_SECRET="test secret" node scripts/send-local-webhook.mjs tests/fixtures/WEB-001.json');
  process.exit(1);
}

const rawBody = fs.readFileSync(file, 'utf8');
JSON.parse(rawBody);
const timestamp = process.env.WEBHOOK_TIMESTAMP || String(Math.floor(Date.now() / 1000));
const signature = process.env.WEBHOOK_SIGNATURE || `sha256=${signWebhook(rawBody, timestamp, secret)}`;

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-webhook-key': key,
    'x-webhook-timestamp': timestamp,
    'x-webhook-signature': signature,
  },
  body: rawBody,
});
const responseText = await response.text();
let body;
try {
  body = JSON.parse(responseText);
} catch {
  body = responseText;
}
console.log(JSON.stringify({ httpStatus: response.status, body }, null, 2));
if (response.status >= 500) process.exitCode = 1;
