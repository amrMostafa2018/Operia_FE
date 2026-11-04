# US-07 through US-12 Playwright development fixtures

Run from `Operia_FE` in PowerShell:

```powershell
$env:OPERIA_E2E_PASSWORD = Read-Host 'Temporary E2E account password'
$env:OPERIA_E2E_OTP = Read-Host 'Six-digit development OTP'
npm run test:e2e -- e2e/us-07.spec.ts e2e/us-08.spec.ts e2e/us-09.spec.ts e2e/us-10.spec.ts e2e/us-11.spec.ts e2e/us-12.spec.ts
```

Playwright starts the Development API on port 5151 and Angular on port 4201. The backend uses the existing local `(localdb)\OperiaDev` instance and `Operia_Dev` database. Set both values before each run; the backend resets all three reserved users to the supplied password. No test credential is committed.

The current merged authentication baseline still generates `111111` instead of reading `OtpSettings:DevelopmentCode`. Until that pre-existing mismatch is corrected, set `OPERIA_E2E_OTP` to `111111`; the Playwright setting remains wired so the suite does not need another change when configurable Development OTP support is restored.

`sqlcmd` must be on `PATH`. TC-14 reads the isolated LocalDB fixture to check purchases and legacy installment rows that the customer lookup API omits. US-11 and US-12 also use read-only SQL assertions for transactional audit counts, immutable sale snapshots, and the absence of fabricated purchases, reservations, or successful collections.

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
| Cash sale service           | `e2e70000-0000-4000-8000-000000000070` |
| Installment sale offer      | `e2e70000-0000-4000-8000-000000000071` |
| Stale-draft sale offer      | `e2e70000-0000-4000-8000-000000000072` |
| Owned-session offer         | `e2e70000-0000-4000-8000-000000000073` |
| US-11 collection offer      | `e2e70000-0000-4000-8000-000000000074` |
| Owned-session purchase      | `e2e70000-0000-4000-8000-000000000081` |
| UI collection purchase      | `e2e70000-0000-4000-8000-000000000082` |
| API idempotency purchase    | `e2e70000-0000-4000-8000-000000000083` |
| Progress-locked purchase    | `e2e70000-0000-4000-8000-000000000084` |
| Final-installment purchase  | `e2e70000-0000-4000-8000-000000000085` |

The Staff identity has the real `Staff` role, is active, belongs to the seeded branch, and has a seven-day schedule. The All Staff offer backs the two distinct US-09 purchases. The selected-staff offer is assigned only to the seeded Staff employee and backs the US-10 installment purchase. The pulse offer backs a separate 8,000-pulse purchase. Every purchase stores an immutable offer snapshot.

Only the installment detail purchase has execution history: one completed booking, item, active purchase reservation, and `Closed` history record. The other seeded purchases have no booking history, so the inquiry tests cannot accidentally treat a scheduled or unrelated record as completed execution.

US-11 uses four independent purchases of one saved installment plan. The UI and API collection purchases start after the first payment with no numbered collection and no released sessions. The progress-locked purchase has installment 1 collected, three sessions released, and only two completed. The final-installment purchase has installments 1 and 2 collected and all six previously released sessions completed. Those prerequisite collections model entry state only. The collection asserted by each success test is performed through the real US-11 API and is never preloaded.

US-12 has separate active cash and installment catalog offers, a dedicated offer that a test disables after quoting, and an owned four-session purchase with one session used. The registered customer and owned balance drive the sale-builder choices. No US-12 sale is seeded: UI and API confirmation tests create their own sales through the real confirmation endpoint and then verify the persisted snapshot and audit.

The seed resets offers, package-staff rows, bookings, booking history, reservations, customer purchases, legacy purchase installments, US-11 installment collections, US-12 sales, and audit records **only** under the two reserved E2E tenants. It does not reset other development data. US-08 creates and updates its record under test through the real package API. US-09 and US-10 update their separate seeded catalog offers through the real API, then prove the seeded purchases still read their saved snapshots. UI-only US-07 editor checks may still use Playwright-controlled offer responses.

The runner refuses to reuse an API or Angular server on its dedicated ports. Stop any process occupying 5151 or 4201 before running it. The seed is guarded by the Development environment and a local Operia database check.

## Story suites

- `us-07.spec.ts` uses the seeded category, customer, branch, and Staff employee while creating the installment offer and purchase under test through the real API.
- `us-08.spec.ts` verifies the seeded Staff lookup, then creates All Staff and selected-staff offers and changes one through the real API.
- `us-09.spec.ts` changes the current All Staff catalog offer through the real API, then proves the two seeded purchases remain separate and retain the saved offer name.
- `us-10.spec.ts` changes the current selected-staff offer through the real API, then proves saved session, installment, pulse, price, and completed-execution details remain historical.
- `us-11.spec.ts` collects eligible and final installments through the real API, verifies idempotency, progress locks, released-session booking balance, permission, tenant scope, statement data, and one transactional audit per successful collection.
- `us-12.spec.ts` exercises the sale-builder UI, confirms UI and mixed API drafts through the real API, verifies due-now pricing, owned and unlisted rows, immutable snapshots, idempotency, stale-offer refusal, tenant scope, and one transactional sale audit without a fabricated payment, purchase, reservation, or booking.

Carry the backend seeder, Playwright config, and fixture references forward to later story branches. Add only the scenario data a story needs. The seed does not contain direct-customer, payment-review, refund, audit-history, or revenue-report scenarios introduced after US-12. Keep the operation being tested in the test itself through its real API instead of preloading its successful result. The US-11 and US-12 tests use deterministic API keys; a full rerun starts a fresh API, clears only the reserved tenant rows, and must recreate those successful results cleanly.
