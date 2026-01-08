"use strict";
const axios = require('axios').default;
const BASE_URL = 'https://api.loginguards.com/v1';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000
});

async function checkPlain(password, apiKey, options) {
  if (typeof password !== 'string') throw new Error('password must be string');
  const timeout = options && typeof options.timeoutMs === 'number' ? options.timeoutMs : undefined;
  const resp = await client.post('/check/plain', { password }, { headers: { 'x-api-key': apiKey }, timeout });
  return resp.data;
}

async function ping(apiKey) {
  await client.head('/', { headers: apiKey ? { 'x-api-key': apiKey } : undefined }).catch(() => {});
  return true;
}

module.exports = { checkPlain, ping, BASE_URL };
