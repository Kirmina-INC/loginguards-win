"use strict";
const { logger } = require('../../logger');
const installer = require('../../installer');

module.exports = {
  command: 'uninstall',
  describe: 'Uninstall the plugin and remove all components',
  builder: {},
  handler: async () => {
    try {
      await installer.uninstall();
      console.log('✔ Uninstall completed');
    } catch (err) {
      logger.error(`Uninstall failed: ${err.stack || err.message || err}`);
      console.error('✖ Uninstall failed:', err.message || err);
      process.exit(1);
    }
  }
};
