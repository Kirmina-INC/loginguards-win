# LoginGuards Active Directory Password Protection (Windows)

Enterprise-grade password breach prevention for Windows domains.

## Features

- Zero Trust password validation via LoginGuards API
- No password storage; passwords never logged
- Windows service policy engine (node-windows)
- Secure API key storage (Windows Credential Manager via keytar)
- CLI: `install`, `configure`, `test`, `uninstall`

## Install (development)

```bash
npm i -g @loginguards/loginguards-win
loginguards-win configure
loginguards-win install
loginguards-win test
loginguards-win --help
```


## Configuration

- API base: `https://api.loginguards.com/v1`
- Required header: `x-api-key: <LOGIN_GUARDS_API_KEY>`
- Behavior on API failure is configurable (planned): fail-open or fail-closed

## Security

- Never logs plaintext passwords
- API key stored in Windows Credential Manager
- HTTPS only

## Active Directory Integration (planned)

This preview scaffolds the Windows service and CLI. Integration via the Windows Password Filter with a PowerShell bridge to the Node.js service is planned.

## Uninstall

```bash
loginguards-win uninstall
```
