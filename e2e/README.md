# US-07 through US-15 Playwright development fixtures

Run from `Operia_FE` in PowerShell:

```powershell
$env:OPERIA_E2E_PASSWORD = Read-Host 'Temporary E2E account password'
$env:OPERIA_E2E_OTP = Read-Host 'Six-digit development OTP'
npm run test:e2e -- e2e/us-07.spec.ts e2e/us-08.spec.ts e2e/us-09.spec.ts e2e/us-10.spec.ts e2e/us-11.spec.ts e2e/us-12.spec.ts
npm run test:e2e -- e2e/us-13.spec.ts
npm run test:e2e -- e2e/us-14.spec.ts
npm run test:e2e -- e2e/us-15.spec.ts
```

Playwright starts the Development API on port 5151 and Angular on port 4201. The backend uses the existing local `(localdb)\OperiaDev` instance and `Operia_Dev` database. Set both values before each run; the backend resets all three reserved users to the supplied password. No test credential is committed.

The current merged authentication baseline still generates `111111` instead of reading `OtpSettings:DevelopmentCode`. Until that pre-existing mismatch is corrected, set `OPERIA_E2E_OTP` to `111111`; the Playwright setting remains wired so the suite does not need another change when configurable Development OTP support is restored.

`sqlcmd` must be on `PATH`. The US-13 through US-15 suites use read-only SQL assertions against the reserved LocalDB tenant to verify persisted sale, collection, customer, and booking state. The older US-07 through US-12 specs were carried forward from their fixture branch; they were not rerun on the US-15 schema. That branch removed the legacy `CustomerPackageInstallments` table, so their table-specific assertions require separate reconciliation.

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
| Direct-sale service         | `e2e70000-0000-4000-8000-000000000089` |
| Free booking service        | `e2e70000-0000-4000-8000-000000000090` |
| Pending success sale        | `e2e70000-0000-4000-8000-000000000091` |
| Pending failure sale        | `e2e70000-0000-4000-8000-000000000092` |

The Staff identity has the real `Staff` role, is active, belongs to the seeded branch, and has a seven-day schedule. The All Staff offer backs the two distinct US-09 purchases. The selected-staff offer is assigned only to the seeded Staff employee and backs the US-10 installment purchase. The pulse offer backs a separate 8,000-pulse purchase. Every purchase stores an immutable offer snapshot.

Only the installment detail purchase has execution history: one completed booking, item, active purchase reservation, and `Closed` history record. The other seeded purchases have no booking history, so the inquiry tests cannot accidentally treat a scheduled or unrelated record as completed execution.

US-11 uses four independent purchases of one saved installment plan. The UI and API collection purchases start after the first payment with no numbered collection and no released sessions. The progress-locked purchase has installment 1 collected, three sessions released, and only two completed. The final-installment purchase has installments 1 and 2 collected and all six previously released sessions completed. Those prerequisite collections model entry state only. The collection asserted by each success test is performed through the real US-11 API and is never preloaded.

US-12 has separate active cash and installment catalog offers, a dedicated offer that a test disables after quoting, and an owned four-session purchase with one session used. The registered customer and owned balance drive the sale-builder choices. No US-12 sale is seeded: UI and API confirmation tests create their own sales through the real confirmation endpoint and then verify the persisted snapshot and audit.

The seed resets offers, package-staff rows, bookings, booking history, reservations, customer purchases, sale collection attempts, installment collections, sales, test-created customers, and audit records **only** under the two reserved E2E tenants. It preserves the original registered fixture customer and does not reset other development tenants. US-08 creates and updates its record under test through the real package API. US-09 and US-10 update their separate seeded catalog offers through the real API, then prove the seeded purchases still read their saved snapshots. UI-only US-07 editor checks may still use Playwright-controlled offer responses.

The runner refuses to reuse an API or Angular server on its dedicated ports. Stop any process occupying 5151 or 4201 before running it. The seed is guarded by the Development environment and a local Operia database check.

## Story suites

- `us-07.spec.ts` uses the seeded category, customer, branch, and Staff employee while creating the installment offer and purchase under test through the real API.
- `us-08.spec.ts` verifies the seeded Staff lookup, then creates All Staff and selected-staff offers and changes one through the real API.
- `us-09.spec.ts` changes the current All Staff catalog offer through the real API, then proves the two seeded purchases remain separate and retain the saved offer name.
- `us-10.spec.ts` changes the current selected-staff offer through the real API, then proves saved session, installment, pulse, price, and completed-execution details remain historical.
- `us-11.spec.ts` collects eligible and final installments through the real API, verifies idempotency, progress locks, released-session booking balance, permission, tenant scope, statement data, and one transactional audit per successful collection.
- `us-12.spec.ts` exercises the sale-builder UI, confirms UI and mixed API drafts through the real API, verifies due-now pricing, owned and unlisted rows, immutable snapshots, idempotency, stale-offer refusal, tenant scope, and one transactional sale audit without a fabricated payment, purchase, reservation, or booking.
- `us-13.spec.ts` creates two separate direct service sales through quote and confirmation, checks their shared ledger and absent personal data, rejects packages and owned balances, and checks that switching UI modes clears a selected registered customer.
- `us-14.spec.ts` starts collection cases from two distinct pending installment sales, confirms or fails collection through the real API, and verifies due-now revenue, retry behavior, no fabricated booking, and Book Now recovery. A separate API-confirmed sale proves that an uncollected sale remains pending.
- `us-15.spec.ts` finds and books the seeded registered customer, registers a new customer through the real API before booking, rejects a normalized duplicate and a failed registration, and books a direct customer with a standalone service.

## US-13 through US-15 fixture boundary

| Scenario                        | Seeded prerequisite                                                      | Created or changed by the test                                                                      |
| ------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| US-13 direct sales              | Active standalone direct-sale service, tenant, branch, cashier           | Two distinct direct-customer sales and the one shared direct ledger, through the real sale API      |
| US-13 mode and ownership checks | Registered customer, owned purchase, package offer                       | UI customer-mode changes; rejected quote requests create no sale                                    |
| US-14 collection success        | Pending installment sale `...091` with immutable terms and no collection | Confirmed first-payment attempt, purchase, and audit through `POST /sales/collect`                  |
| US-14 collection failure        | Separate pending installment sale `...092` with no collection            | Failed attempt, then a successful attempt with a new key, through the same API                      |
| US-14 draft and Book Now        | Active cash and installment offers; free service for an occupied slot    | Pending sale, occupied booking, confirmed collection, and recovery result through the real APIs     |
| US-15 registered                | Existing registered customer, Staff schedule, free standalone service    | Registered-customer booking through the real booking API                                            |
| US-15 new                       | Staff schedule and free standalone service; no new-customer record       | Customer registration, duplicate rejection, then booking with the returned ID through the real APIs |
| US-15 direct                    | Staff schedule and free standalone service; no direct booking            | Rejected package booking and successful direct-service booking through the real booking API         |

Every test uses its own sale, collection key, booking key, or new-customer mobile. The two pending US-14 sales are separate records. The zero-price booking service isolates customer-path checks from the payment workflow.

Each of the US-13, US-14, and US-15 suites passed twice on 2026-11-04 with a fresh Development API and reserved-tenant reset for each run: 3/3, 4/4, and 4/4 tests respectively.

Carry the backend seeder, Playwright config, and fixture references forward to later story branches. Add only the scenario data a story needs. The seed contains no completed direct-customer sale, confirmed or failed US-14 collection, new US-15 customer, payment-review, refund, audit-history, or revenue-report outcome. Keep the operation being tested in the test itself through its real API instead of preloading its successful result. Deterministic API keys make a full rerun prove that the reserved-tenant cleanup restored the starting state.
