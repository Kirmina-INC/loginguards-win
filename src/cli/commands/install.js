"use strict";
const { logger } = require('../../logger');
const installer = require('../../installer');

module.exports = {
  command: 'install',
  describe: 'Install and activate the LoginGuards AD password protection plugin',
  builder: {
    failMode: {
      type: 'string',
      choices: ['fail-open', 'fail-closed'],
      default: 'fail-closed',
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
    }
  },
  handler: async (args) => {
    logger.info('Starting installation...');
    try {
      await installer.install({ failMode: args.failMode, pipeName: args.pipeName, logUsername: args.logUsername });
      logger.info('Installation completed.');
      console.log('✔ Installation completed');
    } catch (err) {
      logger.error(`Installation failed: ${err.stack || err.message || err}`);
      console.error('✖ Installation failed:', err.message || err);
      process.exit(1);
    }
  }
};
