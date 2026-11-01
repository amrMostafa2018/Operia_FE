# US-07 through US-10 Playwright development fixtures

Run from `Operia_FE` in PowerShell:

```powershell
$env:OPERIA_E2E_PASSWORD = Read-Host 'Temporary E2E account password'
$env:OPERIA_E2E_OTP = Read-Host 'Six-digit development OTP'
npm run test:e2e -- e2e/us-07.spec.ts e2e/us-08.spec.ts e2e/us-09.spec.ts e2e/us-10.spec.ts
```

Playwright starts the Development API on port 5151 and Angular on port 4201. The backend uses the existing local `(localdb)\OperiaDev` instance and `Operia_Dev` database. Set both values before each run; the backend resets all three reserved users to the supplied password. No test credential is committed.

The current merged authentication baseline still generates `111111` instead of reading `OtpSettings:DevelopmentCode`. Until that pre-existing mismatch is corrected, set `OPERIA_E2E_OTP` to `111111`; the Playwright setting remains wired so the suite does not need another change when configurable Development OTP support is restored.

TC-14 uses `sqlcmd` on `PATH` with Windows authentication to read the isolated LocalDB fixture. It checks all customer purchases and collected installments for the newly saved offer, including purchases with no released sessions that the customer lookup API omits.

The Development-only backend seed restores two reserved tenants on each test run:

| Fixture                     | Value                                  |
| --------------------------- | -------------------------------------- |
| Tenant A owner              | `+201000000071`                        |
| Tenant B owner              | `+201000000072`                        |
| Tenant A Staff user         | `+201000000075`                        |
| Tenant A category           | `e2e70000-0000-4000-8000-000000000017` |
| Tenant A branch             | `e2e70000-0000-4000-8000-000000000004` |
| Tenant A Staff employee     | `e2e70000-0000-4000-8000-000000000019` |
| Tenant A customer           | `e2e70000-0000-4000-8000-000000000006` |
| All Staff offer             | `e2e70000-0000-4000-8000-000000000030` |
| Selected Staff offer        | `e2e70000-0000-4000-8000-000000000031` |
| Pulse offer                 | `e2e70000-0000-4000-8000-000000000032` |
| Repeated purchase A         | `e2e70000-0000-4000-8000-000000000040` |
| Repeated purchase B         | `e2e70000-0000-4000-8000-000000000041` |
| Installment detail purchase | `e2e70000-0000-4000-8000-000000000042` |
| Pulse detail purchase       | `e2e70000-0000-4000-8000-000000000043` |
| Completed execution booking | `e2e70000-0000-4000-8000-000000000060` |

The Staff identity has the real `Staff` role, is active, belongs to the seeded branch, and has a seven-day schedule. The All Staff offer backs the two distinct US-09 purchases. The selected-staff offer is assigned only to the seeded Staff employee and backs the US-10 installment purchase. The pulse offer backs a separate 8,000-pulse purchase. Every purchase stores an immutable offer snapshot.

Only the installment detail purchase has execution history: one completed booking, item, active purchase reservation, and `Closed` history record. The other seeded purchases have no booking history, so the inquiry tests cannot accidentally treat a scheduled or unrelated record as completed execution.

The seed resets offers, package-staff rows, bookings, booking history, reservations, customer purchases, purchase installments, and audit records **only** under the two reserved E2E tenants. It does not reset other development data. US-08 creates and updates its record under test through the real package API. US-09 and US-10 update their separate seeded catalog offers through the real API, then prove the seeded purchases still read their saved snapshots. UI-only US-07 editor checks may still use Playwright-controlled offer responses.

The runner refuses to reuse an API or Angular server on its dedicated ports. Stop any process occupying 5151 or 4201 before running it. The seed is guarded by the Development environment and a local Operia database check.

## Story suites

- `us-07.spec.ts` uses the seeded category, customer, branch, and Staff employee while creating the installment offer and purchase under test through the real API.
- `us-08.spec.ts` verifies the seeded Staff lookup, then creates All Staff and selected-staff offers and changes one through the real API.
- `us-09.spec.ts` changes the current All Staff catalog offer through the real API, then proves the two seeded purchases remain separate and retain the saved offer name.
- `us-10.spec.ts` changes the current selected-staff offer through the real API, then proves saved session, installment, pulse, price, and completed-execution details remain historical.

Carry the backend seeder, Playwright config, and fixture references forward to later story branches. Add only the scenario data a story needs. The seed does not contain payment-review, refund, audit-history, or revenue-report scenarios introduced after US-10. Keep the operation being tested in the test itself through its real API instead of preloading its successful result.
