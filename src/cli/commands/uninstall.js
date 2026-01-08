"use strict";
const { logger } = require('../../logger');
const installer = require('../../installer');

module.exports = {
  command: 'uninstall',
  describe: 'Uninstall the plugin and remove all components',
  builder: {
    reboot: { type: 'boolean', default: false, describe: 'If true (on DC), reboot after unregistering the password filter' }
  },
  handler: async (args) => {
    try {
      await installer.uninstall({ reboot: args.reboot });
      console.log('✔ Uninstall completed');
    } catch (err) {
      logger.error(`Uninstall failed: ${err.stack || err.message || err}`);
      console.error('✖ Uninstall failed:', err.message || err);
      process.exit(1);
    }
  }
};
