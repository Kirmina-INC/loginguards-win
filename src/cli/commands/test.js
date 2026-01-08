"use strict";
const { logger } = require('../../logger');
const tester = require('../../tester');

module.exports = {
  command: 'test',
  describe: 'Run end-to-end validation across AD and LoginGuards',
  builder: {
    user: { type: 'string', describe: 'Domain user to simulate', default: process.env.USERNAME ? `${process.env.USERDOMAIN || 'DOMAIN'}\\${process.env.USERNAME}` : undefined },
    mode: { type: 'string', choices: ['auto', 'dc', 'client'], default: 'auto', describe: 'Validation mode: detect DC (auto), force DC or client mode' },
    verbose: { type: 'boolean', default: false, describe: 'Print extra diagnostics' }
  },
  handler: async (args) => {
    try {
      await tester.run(args);
    } catch (err) {
      logger.error(`Test failed: ${err.stack || err.message || err}`);
      console.error('✖ Test failed:', err.message || err);
      process.exit(1);
    }
  }
};
