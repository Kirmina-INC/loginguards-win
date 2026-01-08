"use strict";
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

async function run(argvInput) {
  const raw = hideBin(argvInput || process.argv);
  // pnpm passes a literal "--" before forwarded args; strip it so yargs sees the command
  if (raw.length && raw[0] === '--') raw.shift();
  const argv = yargs(raw)
    .scriptName('loginguards-win')
    .usage('$0 <cmd> [args]')
    .command(require('./commands/install'))
    .command(require('./commands/configure'))
    .command(require('./commands/test'))
    .command(require('./commands/pipe-test'))
    .command(require('./commands/uninstall'))
    .demandCommand(1, 'Please provide a command')
    .strict()
    .help()
    .argv;
  return argv;
}

module.exports = { run };
