# US-07 Playwright E2E report — installment plan and session release

## Repeatable seeded run — 2026-10-30

The updated runner restored its dummy tenants and prerequisites in `Operia_Dev`, then completed all **5 tests** in **1.9 minutes** with no failures or skips. The tests used the seeded category, branch, employee, and customer; offers under test were created through the real API. A prior full run passed the real API cases but hit the 30-second limit in the validation UI case, so the normal Playwright limit is now 60 seconds. The focused validation rerun and this complete rerun both passed.

## Result

**Passed:** 5 Playwright tests covering all 15 US-07 cases (TC-01 through TC-15), 0 failed, 0 skipped.
The visible Chrome run completed on **2026-10-30 at 19:50 Africa/Cairo** in **2.1 minutes** in headed Google Chrome.

Test source: `e2e/us-07.spec.ts`.

## Environment and evidence boundary

| Item           | Value                                                                    | Evidence Boundary                                       |
| -------------- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| Frontend       | Angular dev server, `http://localhost:4200`                              | UI rendered in real browser                             |
| API            | ASP.NET API, `http://localhost:5150`                                     | Real test API for persistence, ceiling, and collections |
| Database       | SQL Server LocalDB `(localdb)\MSSQLLocalDB`, database `Operia_Local`     | Real database for persistence, ceiling, and purchases   |
| Browser        | Installed Google Chrome (`channel: 'chrome'`), headed with action pacing | Live visual execution                                   |
| Authentication | Real login + OTP (`+201095685986` / `111111`)                            | Center Admin authenticated on real identity service     |
| Multi-tenancy  | Tenant A (`e479fed6...`) vs Tenant B (`11111111...`)                     | Isolation verified across distinct DB tenants           |

### Evidence boundary notice

- **Controlled API responses** were used strictly for client-side editor interactions and validation behavior (TC-01, TC-02, TC-03, TC-04, TC-05, TC-06, TC-07, TC-08).
- **Real API and Database** were used for all persistence, ceiling rules, tenant isolation, and booking payment flows (TC-01 & TC-02 persistence, TC-09, TC-10, TC-11, TC-12, TC-13, TC-14, TC-15).
- No mocked response was used to claim persistence or collection safety.

---

## Scenario results breakdown (TC-01 through TC-15)

| ID        | Title / Scenario                                                                                   | Tested Boundary                 | Result     | Key Observations / Assertions                                                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------- | ------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TC-01** | Package offer creation with 10 sessions, 5,000 first payment, count 3, 5,000 each (releases 3/4/3) | Editor UI & Real DB Persistence | **Passed** | Ordered rows submitted; readback confirms amounts 5,000 / 5,000 / 5,000 and cumulative releases 3 / 7 / 10.                                              |
| **TC-02** | Unequal nonnegative row amounts (4,000 / 6,000 / 5,000 totaling 15,000)                            | Editor UI & Real DB Persistence | **Passed** | Accepted; order preserved; first payment kept separate from numbered installments.                                                                       |
| **TC-03** | Row amounts not totaling remaining balance (4,000 / 5,000 / 5,000 != 15,000)                       | Editor UI Validation            | **Passed** | Inline error shown; save blocked; zero create/update requests dispatched.                                                                                |
| **TC-04** | Missing first payment, empty/zero installment count, count mismatch                                | Editor UI Validation            | **Passed** | Required/range inline field errors rendered; save blocked until corrected.                                                                               |
| **TC-05** | First payment > installment price (25,000 > 20,000) or zero row amounts                            | Editor UI Validation & API      | **Passed** | Inline error prevents save when first payment > price; zero row amounts valid when total balances.                                                       |
| **TC-06** | Price change to 21,000, suggest distribution, manual row override                                  | Editor UI                       | **Passed** | Remaining balance updates to 16,000; manual edits are saved rather than overridden.                                                                      |
| **TC-07** | Single session rules & plan replacement confirmation                                               | Editor UI                       | **Passed** | Single session has no installment inputs; switching package with plan prompts modal; confirming clears plan.                                             |
| **TC-08** | Row releases exceeding session count (e.g. 6 + 5 = 11 > 10)                                        | Editor UI Validation            | **Passed** | Inline session-allocation error displayed; save blocked.                                                                                                 |
| **TC-09** | 10-session prepayment ceiling (max 7): 8/0/2 rejected, 3/4/3 accepted                              | Real API & DB                   | **Passed** | Real API rejects 8/0/2 with `PACKAGE_INSTALLMENT_RELEASE_CAP`; accepts 3/4/3.                                                                            |
| **TC-10** | 15-session ceiling (10.5 rounds down to 10): 11 rejected, 10 accepted                              | Real API & DB                   | **Passed** | Real API rejects 11 release with `PACKAGE_INSTALLMENT_RELEASE_CAP`; accepts 10.                                                                          |
| **TC-11** | 1-session package ceiling: early release rejected; unlocks on full payment                         | Real API & DB                   | **Passed** | Real API rejects early release row; accepts releasing 1 on final row (0 / 1).                                                                            |
| **TC-12** | Installment purchase sale & payment progression                                                    | Real API & DB                   | **Passed** | Real booking creates installment purchase; first payment releases 0 sessions; numbered installments add planned sessions up to 10 total on full payment. |
| **TC-13** | Payment failure resistance & idempotency                                                           | Real API & DB                   | **Passed** | Failed payment attempt leaves paid amount and released sessions unchanged; repeated confirmed payment is idempotent.                                     |
| **TC-14** | Offer configuration alone does not create entitlements                                             | Real API & DB                   | **Passed** | Creating an offer without sales creates 0 customer entitlements or collections (`404` on purchase endpoint).                                             |
| **TC-15** | Cross-tenant isolation                                                                             | Real API & DB                   | **Passed** | Tenant B receives `404` when reading or updating Tenant A's offer; Tenant A's plan remains untouched.                                                    |

---

## How to run headed

The original result above was recorded against a manually prepared development account. The current repeatable runner uses the two seeded dummy tenants described in `e2e/README.md`. From `C:\OLD\Operia Project\Operia_FE`:

```powershell
$env:OPERIA_E2E_PASSWORD = Read-Host 'Temporary E2E account password'
$env:OPERIA_E2E_OTP = Read-Host 'Six-digit development OTP'
$env:OPERIA_E2E_BROWSER_CHANNEL="chrome"
$env:OPERIA_E2E_SLOW_MO_MS="100"
npm run test:e2e -- e2e/us-07.spec.ts --headed
```
