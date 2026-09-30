#!/usr/bin/env node
import fs from 'node:fs';
import { signWebhook } from './lib/lead-logic.mjs';

const [file] = process.argv.slice(2);
const url = process.env.WEBHOOK_URL || 'http://127.0.0.1:5678/webhook/lead-qualification';
const key = process.env.WEBHOOK_KEY;
const secret = process.env.WEBHOOK_HMAC_SECRET;

if (!file || !key || !secret) {
  console.error('Usage: WEBHOOK_KEY="test key" WEBHOOK_HMAC_SECRET="test secret" node scripts/send-concurrent-webhooks.mjs tests/fixtures/WEB-001.json');
  process.exit(1);
}

const rawBody = fs.readFileSync(file, 'utf8');
JSON.parse(rawBody);
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = `sha256=${signWebhook(rawBody, timestamp, secret)}`;
const send = async () => {
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
  return { httpStatus: response.status, body: await response.json() };
};

const responses = await Promise.all([send(), send()]);
console.log(JSON.stringify(responses, null, 2));
