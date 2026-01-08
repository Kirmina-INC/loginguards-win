"use strict";
const storage = require('../../storage');
const apiClient = require('../../apiClient');
const { logger } = require('../../logger');

module.exports = {
  command: 'check',
  describe: 'Check one or more passwords against LoginGuards (no passwords are logged or stored)',
  builder: {
    password: { type: 'string', describe: 'Password to check (avoid history; prefer --prompt or --stdin)' },
    prompt: { type: 'boolean', default: false, describe: 'Securely prompt for a password' },
    stdin: { type: 'boolean', default: false, describe: 'Read newline-separated passwords from stdin' },
    debug: { type: 'boolean', default: false, describe: 'Print raw API response (sanitized)' }
  },
  handler: async (args) => {
    const apiKey = await storage.getApiKey();
    if (!apiKey) {
      console.log('✖ API key not configured. Run "loginguards-win configure".');
      process.exit(1);
    }

    async function evalOne(pwd) {
      try {
        const res = await apiClient.checkPlain(pwd, apiKey);
        if (args.debug) {
          try { console.log('debug response:', JSON.stringify(res)); } catch {}
        }
        const compromised = (typeof res.breached !== 'undefined') ? !!res.breached
          : (typeof res.compromised !== 'undefined') ? !!res.compromised
          : (typeof res.is_compromised !== 'undefined') ? !!res.is_compromised
          : (typeof res.isCompromised !== 'undefined') ? !!res.isCompromised
          : (typeof res.count === 'number') ? res.count > 0
          : false;
        if (compromised) {
          console.log('✖ COMPROMISED');
        } else {
          console.log('✔ NOT COMPROMISED');
        }
      } catch (e) {
        const status = e && e.response && e.response.status;
        if (status === 401) console.log('✖ Error: Unauthorized (invalid API key)');
        else if (status === 429) console.log('✖ Error: Rate limited');
        else console.log('✖ Error:', e.message || String(e));
        logger.warn(`check command API error: ${status || e.code || e.message}`);
        process.exitCode = 1;
      }
    }

    if (args.stdin) {
      // batch mode from stdin
      const chunks = [];
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (d) => chunks.push(d));
      process.stdin.on('end', async () => {
        const text = chunks.join('');
        const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (!lines.length) { console.log('No input passwords.'); return; }
        for (const line of lines) {
          await evalOne(line);
        }
      });
      if (process.stdin.readableEnded) {
        // no stdin piped
        console.log('No stdin provided. Use --password or --prompt instead.');
      }
      return;
    }

    if (typeof args.password === 'string' && args.password.length > 0) {
      await evalOne(args.password);
      return;
    }

    // prompt safely
    try {
      const inquirer = (await import('inquirer')).default;
      const ans = await inquirer.prompt([{ type: 'password', name: 'pwd', message: 'Enter password to check', mask: '*', validate: v => v ? true : 'Required' }]);
      await evalOne(ans.pwd);
    } catch (e) {
      console.error('✖ Prompt failed:', e.message || String(e));
      process.exit(1);
    }
  }
};
