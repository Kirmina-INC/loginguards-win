"use strict";
const { spawn } = require('child_process');

function runPS(script) {
  return new Promise((resolve, reject) => {
    const ps = spawn(process.env.ComSpec ? 'powershell.exe' : 'powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command', '-'
    ], { windowsHide: true });

    let stdout = '';
    let stderr = '';
    ps.stdout.on('data', d => { stdout += d.toString(); });
    ps.stderr.on('data', d => { stderr += d.toString(); });
    ps.on('error', reject);
    ps.on('close', (code) => {
      if (code !== 0 && stderr) return reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`));
      resolve({ stdout, stderr, exitCode: code });
    });

    ps.stdin.end(script);
  });
}

module.exports = { runPS };
