"use strict";
const { logger } = require('../../logger');
const installer = require('../../installer');
function normalizeFailMode(v) {
  if (!v) return 'fail-open';
  const s = String(v).toLowerCase();
  if (s === 'open' || s === 'fail-open') return 'fail-open';
  if (s === 'closed' || s === 'fail-closed') return 'fail-closed';
  return 'fail-open';
}

module.exports = {
  command: 'install',
  describe: 'Install and activate the LoginGuards AD password protection plugin',
  builder: {
    failMode: {
      type: 'string',
      choices: ['fail-open', 'fail-closed', 'open', 'closed'],
      default: 'fail-open',
      describe: 'Behavior if API unreachable'
    },
    pipeName: {
      type: 'string',
      default: "\\\\.\\pipe\\LoginGuardsPwdFilter",
      describe: 'Named pipe for the password filter to connect to'
    },
    logUsername: {
      type: 'boolean',
      default: false,
      describe: 'If true, log the username in audit logs (never logs passwords)'
    },
    timeoutMs: {
      type: 'number',
      default: 1500,
      describe: 'Max time in milliseconds to wait for API decision (DLL also times out)'
    },
    dllPath: {
      type: 'string',
      describe: 'Path to prebuilt x64 LoginGuardsPwdFilter.dll (required on DC if not bundled)'
    },
    reboot: {
      type: 'boolean',
      default: false,
      describe: 'If true and on DC, reboot after registering the password filter'
    }
  },
  handler: async (args) => {
    logger.info('Starting installation...');
    try {
      const fm = normalizeFailMode(args.failMode);
      await installer.install({ failMode: fm, pipeName: args.pipeName, logUsername: args.logUsername, timeoutMs: args.timeoutMs, dllPath: args.dllPath, reboot: args.reboot });
      logger.info('Installation completed.');
      console.log('✔ Installation completed');
    } catch (err) {
      logger.error(`Installation failed: ${err.stack || err.message || err}`);
      console.error('✖ Installation failed:', err.message || err);
      process.exit(1);
    }
  }
};
