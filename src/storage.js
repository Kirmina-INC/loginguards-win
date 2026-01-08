"use strict";
const fs = require('fs');
const path = require('path');
const os = require('os');
const { runPS } = require('./ps');

const SERVICE = 'LoginGuards';
const ACCOUNT = 'api-key';

let keytar = null;
try {
  // optional dependency
  keytar = require('keytar');
} catch {}

const baseDir = process.env.PROGRAMDATA || path.join(os.homedir(), 'AppData', 'Local');
const confDir = path.join(baseDir, 'LoginGuards');
const confFile = path.join(confDir, 'config.json');

function ensureDir() {
  if (!fs.existsSync(confDir)) fs.mkdirSync(confDir, { recursive: true });
}

async function saveApiKey(apiKey) {
  // Always persist a LocalMachine-encrypted copy for the service
  ensureDir();
  const enc = await dpapiProtect(apiKey);
  let data = {};
  try { data = JSON.parse(fs.readFileSync(confFile, 'utf8')); } catch {}
  data.apiKeyEnc = enc;
  fs.writeFileSync(confFile, JSON.stringify(data, null, 2), { encoding: 'utf8' });
  // Additionally store in Keytar (user context) when available
  if (keytar) {
    try { await keytar.setPassword(SERVICE, ACCOUNT, apiKey); } catch {}
  }
}

async function getApiKey() {
  // Prefer LocalMachine file so the service can read it
  try {
    const raw = fs.readFileSync(confFile, 'utf8');
    const data = JSON.parse(raw);
    if (data && data.apiKeyEnc) {
      return await dpapiUnprotect(data.apiKeyEnc);
    }
  } catch {}
  if (keytar) {
    try { return await keytar.getPassword(SERVICE, ACCOUNT); } catch {}
  }
  return null;
}

async function deleteApiKey() {
  if (keytar) {
    try { await keytar.deletePassword(SERVICE, ACCOUNT); } catch {}
  }
  try { fs.unlinkSync(confFile); } catch {}
}

async function dpapiProtect(plain) {
  const script = `
  $plain = @'
${plain.replace(/'/g, "''")}
'@
  try { Add-Type -AssemblyName 'System.Security' -ErrorAction SilentlyContinue } catch {}
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($plain)
    $enc = [System.Security.Cryptography.ProtectedData]::Protect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::LocalMachine)
    [Convert]::ToBase64String($enc)
  } catch {
    try {
      $secure = ConvertTo-SecureString $plain -AsPlainText -Force
      $hasScope = (Get-Command ConvertFrom-SecureString).Parameters.ContainsKey('Scope')
      if ($hasScope) { $encStr = ConvertFrom-SecureString $secure -Scope LocalMachine } else { $encStr = ConvertFrom-SecureString $secure }
      'SS:' + $encStr
    } catch { throw }
  }
  `;
  const { stdout } = await runPS(script);
  return stdout.trim();
}

async function dpapiUnprotect(b64) {
  if (b64.startsWith('SS:')) {
    const encStr = b64.slice(3);
    const scriptSS = `
    $encStr = @'
${encStr.replace(/'/g, "''")}
'@
    $secure = ConvertTo-SecureString $encStr
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    [Runtime.InteropServices.Marshal]::PtrToStringUni($bstr)
    `;
    const { stdout } = await runPS(scriptSS);
    return stdout.replace(/\r?\n$/, '');
  }
  const script = `
  try { Add-Type -AssemblyName 'System.Security' -ErrorAction SilentlyContinue } catch {}
  $b64 = '${b64.replace(/'/g, "''")}'
  $bytes = [Convert]::FromBase64String($b64)
  $dec = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::LocalMachine)
  [System.Text.Encoding]::UTF8.GetString($dec)
  `;
  const { stdout } = await runPS(script);
  return stdout.replace(/\r?\n$/, '')
}

module.exports = { saveApiKey, getApiKey, deleteApiKey };
