#!/usr/bin/env node
"use strict";
const { run } = require('../src/cli');

run().catch(err => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
