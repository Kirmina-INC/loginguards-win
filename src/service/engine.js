"use strict";
const { logger } = require('../logger');
const net = require('net');
const { getConfig } = require('../config');
const storage = require('../storage');
const apiClient = require('../apiClient');

logger.info('LoginGuards Policy Engine service started.');

let shuttingDown = false;

function parseJsonLine(buf) {
  const s = buf.toString('utf8').trim();
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

async function evaluatePassword(password) {
  const { failMode } = getConfig();
  const apiKey = await storage.getApiKey();
  if (!apiKey) {
    return { allow: failMode === 'fail-open', reason: 'no_api_key' };
  }
  try {
    const res = await apiClient.checkPlain(password, apiKey);
    const compromised = (typeof res.breached !== 'undefined') ? !!res.breached
      : (typeof res.compromised !== 'undefined') ? !!res.compromised
      : (typeof res.is_compromised !== 'undefined') ? !!res.is_compromised
      : (typeof res.isCompromised !== 'undefined') ? !!res.isCompromised
      : (typeof res.count === 'number') ? res.count > 0
      : false;
    return { allow: !compromised, reason: compromised ? 'compromised' : 'ok' };
  } catch (e) {
    logger.warn(`API error during evaluation: ${e.status || e.code || e.message}`);
    return { allow: failMode === 'fail-open', reason: 'api_error' };
  }
}

function startPipeServer() {
  const { pipeName } = getConfig();
  const server = net.createServer((socket) => {
    let buffer = '';
    socket.on('data', async (chunk) => {
      buffer += chunk.toString('utf8');
      let idx;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        const msg = parseJsonLine(Buffer.from(line, 'utf8'));
        if (!msg || typeof msg.password !== 'string') {
          socket.write(JSON.stringify({ allow: false, reason: 'bad_request' }) + '\n');
          continue;
        }
        const { allow, reason } = await evaluatePassword(msg.password);
        // Never log plaintext passwords
        if (reason === 'compromised') logger.info('Password evaluation: compromised');
        else logger.info(`Password evaluation result: ${reason}`);
        socket.write(JSON.stringify({ allow, reason }) + '\n');
      }
    });
    socket.on('error', () => {});
  });

  server.on('error', (err) => {
    logger.error(`Pipe server error: ${err.message || err}`);
  });

  server.listen(pipeName, () => {
    logger.info(`Named pipe server listening on ${pipeName}`);
  });

  return server;
}

const server = startPipeServer();

process.on('SIGINT', () => { shuttingDown = true; server && server.close(); process.exit(0); });
process.on('SIGTERM', () => { shuttingDown = true; server && server.close(); process.exit(0); });

// keep process alive
setInterval(() => { if (shuttingDown) clearInterval(this); }, 1 << 30);
