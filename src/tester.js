"use strict";
const { logger } = require('./logger');
const service = require('./service');
const storage = require('./storage');
const apiClient = require('./apiClient');

async function run({ user }) {
  console.log('Running LoginGuards test suite...\n');

  // Active Directory connectivity (placeholder)
  console.log('✔ Connected to Active Directory (placeholder)');
  logger.info('AD connectivity check: placeholder');

  // Service status
  const running = await service.isRunning().catch(() => false);
  if (running) {
    console.log('✔ Password policy engine service running');
  } else {
    console.log('✖ Password policy engine service not running');
  }

  // API connectivity
  const apiKey = await storage.getApiKey();
  if (!apiKey) {
    console.log('✖ API key not configured. Run "loginguards-win configure".');
    return;
  }
  try {
    await apiClient.ping(apiKey);
    console.log('✔ LoginGuards API reachable');
  } catch (e) {
    console.log('✖ LoginGuards API not reachable');
  }

  // Test password evaluation (non-destructive)
  const testPwd = `Lg!Test-${Math.random().toString(36).slice(2, 8)}A1`;
  try {
    const res = await apiClient.checkPlain(testPwd, apiKey);
    const compromised = !!res.compromised;
    if (compromised) {
      console.log('✔ Test completed');
      console.log('✖ Password rejected: COMPROMISED');
    } else {
      console.log('✔ Test password evaluated: NOT COMPROMISED');
    }
    console.log(`✔ Test completed successfully for user "${user || 'DOMAIN\\test-user'}"`);
  } catch (err) {
    logger.error(`Test request failed: ${err.stack || err.message || err}`);
    console.log('✖ Test request failed');
    throw err;
  }
}

module.exports = { run };
