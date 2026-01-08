# LoginGuards Active Directory Password Protection (Windows)

Enterprise-grade password breach prevention for Windows domains.

## Features

- Zero Trust password validation via LoginGuards API
- Windows Password Filter DLL for domain-wide enforcement on DCs
- Local Windows service policy engine (named pipe IPC)
- No password storage; passwords never logged
- Secure API key storage (Windows Credential Manager via keytar)
- CLI: `configure`, `install`, `test`, `uninstall`, `check`, `pipe-test`

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
- Behavior on API failure is configurable: `fail-open` (default) or `fail-closed`
- Timeout default: `1500ms` (configurable)

## Security

- Never logs plaintext passwords
- API key stored in Windows Credential Manager
- HTTPS only

## Active Directory Integration (V2)

V2 includes a signed x64 Windows Password Filter DLL that runs inside LSASS on Domain Controllers and communicates with the local policy engine via a named pipe (`\\.\\pipe\\LoginGuardsPwdFilter`). The service calls the LoginGuards API and returns an allow/deny decision to the DLL.

Decision mapping uses the API field `breached` and returns reasons: `SAFE`, `COMPROMISED`, `API_DOWN`, `TIMEOUT`, `NO_API_KEY`. Default policy is `fail-open`.

## Deployment (Domain Controller only)

1. Configure API connectivity on the DC:
   ```bash
   loginguards-win configure
   ```
2. Install service and register the password filter (admin required; reboot recommended):
   ```bash
   # A prebuilt DLL can be bundled at assets/LoginGuardsPwdFilter/x64/LoginGuardsPwdFilter.dll
   # Or provide an explicit path via --dllPath
   loginguards-win install \
     --failMode open \
     --timeoutMs 1500 \
     --pipeName "\\.\\pipe\\LoginGuardsPwdFilter" \
     --reboot
   ```
3. Reboot is required for the password filter to load into LSASS.

To uninstall on a DC:
```bash
loginguards-win uninstall --reboot
```

## Test and Diagnostics

- Domain Controller mode:
  ```bash
  loginguards-win test --mode dc
  ```
  Validates service, pipe, registry (Notification Packages), DLL presence, API reachability, and evaluates a non-destructive test password.

- Client mode (domain-joined workstation):
  ```bash
  loginguards-win test --mode client
  ```
  Shows domain membership and logon server; enforcement validation must be run on a DC.

- Direct password check (no storage/logging):
  ```bash
  loginguards-win check --prompt
  # or
  loginguards-win check --password "YourPassword" --debug
  ```

## Recommended Rollout (Safety)

- Deploy to a secondary Domain Controller first
- Validate password resets/changes with test users
- Roll out to all Domain Controllers after validation

## Uninstall

```bash
loginguards-win uninstall
```
