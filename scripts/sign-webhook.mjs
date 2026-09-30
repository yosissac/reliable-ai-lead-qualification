#!/usr/bin/env node
import fs from 'node:fs';
import { signWebhook } from './lib/lead-logic.mjs';

const [file] = process.argv.slice(2);
const secret = process.env.WEBHOOK_HMAC_SECRET;
if (!file || !secret) {
  console.error('Usage: WEBHOOK_HMAC_SECRET="test secret" node scripts/sign-webhook.mjs tests/fixtures/WEB-001.json');
  process.exit(1);
}
// Do not trim or reformat. HMAC verification depends on signing the exact bytes
// that curl sends with --data-binary @file.
const rawBody = fs.readFileSync(file, 'utf8');
JSON.parse(rawBody);
const timestamp = String(Math.floor(Date.now() / 1000));
console.log(JSON.stringify({ timestamp, signature: `sha256=${signWebhook(rawBody, timestamp, secret)}` }, null, 2));
