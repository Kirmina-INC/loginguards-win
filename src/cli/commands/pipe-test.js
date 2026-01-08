"use strict";
const net = require('net');
const { getConfig } = require('../../config');
const { logger } = require('../../logger');

module.exports = {
  command: 'pipe-test',
  describe: 'Send a test password to the service via named pipe IPC',
  builder: {
    password: { type: 'string', describe: 'Test password to evaluate (will not be logged)' },
    username: { type: 'string', describe: 'Optional username for audit (not required)' }
  },
  handler: async (args) => {
    const { pipeName } = getConfig();
    const pwd = args.password || `Lg!PipeTest-${Math.random().toString(36).slice(2, 8)}A1`;

    console.log(`Connecting to named pipe: ${pipeName}`);

    await new Promise((resolve, reject) => {
      const socket = net.createConnection(pipeName, () => {
        const msg = { password: pwd };
        // Never log plaintext
        socket.write(JSON.stringify(msg) + '\n');
      });

      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString('utf8');
        let idx;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          try {
            const resp = JSON.parse(line);
            const allow = !!resp.allow;
            const reason = resp.reason || (allow ? 'ok' : 'rejected');
            if (allow) console.log('✔ Pipe test password evaluated: NOT COMPROMISED');
            else console.log('✖ Password rejected:', reason.toUpperCase());
            resolve();
            socket.end();
          } catch (e) {
            logger.warn('Invalid JSON from pipe');
            reject(new Error('Invalid response from service'));
            socket.destroy();
          }
        }
      });
      socket.on('error', (err) => {
        reject(new Error(`Pipe connection error: ${err.message || err}`));
      });
      socket.on('end', () => {});
    }).catch((e) => {
      console.error('✖ Pipe test failed:', e.message || e);
      process.exit(1);
    });
  }
};
