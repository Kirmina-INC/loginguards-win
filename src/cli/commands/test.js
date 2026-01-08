"use strict";
const { logger } = require('../../logger');
const tester = require('../../tester');

module.exports = {
  command: 'test',
  describe: 'Run end-to-end validation across AD and LoginGuards',
  builder: {
    user: { type: 'string', describe: 'Domain user to simulate', default: process.env.USERNAME ? `${process.env.USERDOMAIN || 'DOMAIN'}\\${process.env.USERNAME}` : undefined }
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
