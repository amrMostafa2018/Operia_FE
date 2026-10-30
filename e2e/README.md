# US-07 Playwright development fixtures

Run from `Operia_FE` in PowerShell:

```powershell
$env:OPERIA_E2E_PASSWORD = Read-Host 'Temporary E2E account password'
$env:OPERIA_E2E_OTP = Read-Host 'Six-digit development OTP'
npm run test:e2e -- e2e/us-07.spec.ts
```

Playwright starts the Development API on port 5151 and Angular on port 4201. The backend uses the existing local `(localdb)\OperiaDev` instance and `Operia_Dev` database. Set both values before each run; the backend resets the two dummy users to the supplied password and configures its local OTP from the supplied code. No test credential is committed.

The Development-only backend seed restores two reserved tenants on each test run:

| Fixture           | Value                                  |
| ----------------- | -------------------------------------- |
| Tenant A user     | `+201000000071`                        |
| Tenant B user     | `+201000000072`                        |
| Tenant A category | `e2e70000-0000-4000-8000-000000000017` |
| Tenant A branch   | `e2e70000-0000-4000-8000-000000000004` |
| Tenant A employee | `e2e70000-0000-4000-8000-000000000005` |
| Tenant A customer | `e2e70000-0000-4000-8000-000000000006` |

The seed resets offers, bookings, customer purchases, and audit records **only** under these reserved tenants. It does not reset other development data. Tests create the offer under examination through the real API. UI-only editor checks may still use Playwright-controlled offer responses.

The runner refuses to reuse an API or Angular server on its dedicated ports. Stop any process occupying 5151 or 4201 before running it. The seed is guarded by the Development environment and a local Operia database check.

## Later stories

Carry the backend seeder, Playwright config, and fixture references forward to each story branch. Reuse the accounts and basic catalog/booking prerequisites, then add only the new scenario data that the next story needs. This seed does not yet contain the payment, refund, audit, or revenue scenarios introduced by later stories. Keep the operation being tested in the test itself through its real API rather than preloading its successful result.
