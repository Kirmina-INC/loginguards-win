"use strict";
const storage = require('../../storage');
const apiClient = require('../../apiClient');
const { logger } = require('../../logger');

module.exports = {
  command: 'configure',
  describe: 'Configure LoginGuards API key and connectivity',
  builder: {},
  handler: async () => {
    try {
      // Inquirer v9 is ESM-only; load dynamically
      const inquirer = (await import('inquirer')).default;
      const answers = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'Enter LoginGuards API key',
          mask: '*',
          validate: v => v && v.trim().length > 0 ? true : 'API key required'
        },
        {
          type: 'input',
          name: 'org',
          message: 'Organization/Project identifier (optional)'
        }
      ]);
      await storage.saveApiKey(answers.apiKey);
      logger.info('Saved API key in secure storage');
      // Best-effort reachability test (no password)
      await apiClient.ping(answers.apiKey).catch(() => {});
      console.log('✔ API key stored securely');
    } catch (err) {
      logger.error(`Configure failed: ${err.stack || err.message || err}`);
      console.error('✖ Configure failed:', err.message || err);
      process.exit(1);
    }
  }
};
