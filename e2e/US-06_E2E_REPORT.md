# US-06 Playwright E2E report

## Result

**Passed:** 1 Playwright test, 5 named US-06 steps, 0 skipped. The visible Chrome run completed on **2026-10-29 at 22:03 Africa/Cairo** in **32.8 seconds** (test duration 30.7 seconds). The same suite also passed at normal speed in 7.8 seconds.

The test source is `e2e/us-06.spec.ts`. Playwright generated `playwright-report/index.html` and a video under `test-results/`. These generated files are local and ignored by Git; rerunning the suite regenerates them.

## Environment and evidence boundary

| Item           | Value                                                                        |
| -------------- | ---------------------------------------------------------------------------- |
| Frontend       | Angular development server, `http://localhost:4200`                          |
| API            | Local ASP.NET API, `http://localhost:5150`, reached through `/api` proxy     |
| Database       | SQL Server LocalDB `(localdb)\OperiaDev`, database `Operia_Dev`              |
| Browser        | Installed Google Chrome, headed with 400 ms action pacing                    |
| Authentication | Real login and OTP against the development API; account reached `/dashboard` |
| Offer API      | Playwright-controlled categories and package create/read/update responses    |

The proxy and direct local API returned identical public plans responses, and a SQL query confirmed the local database name. The test does **not** write an offer to the database or exercise a production API. It checks the editor, its validation, and the payload it sends. The account's active onboarding status was used as returned by the real API in this run.

## Scenario results

| Case  | Checked behavior                                                                                      | Result                                            |
| ----- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| TC-01 | Save and reopen separate cash 18,000 and installment 20,000 prices, with `CASH10` and 10% discount.   | Passed with controlled offer API                  |
| TC-02 | Installment-only remains valid; disabling both payment methods shows an inline error and blocks save. | Passed with controlled offer API                  |
| TC-03 | The 10% discount previews cash at 16,200 while installments stay at 20,000.                           | Passed                                            |
| TC-04 | A negative cash price and a discount above 100% show field errors and send no save request.           | Passed                                            |
| TC-07 | An enabled installment price of zero shows an inline error and blocks save.                           | Passed                                            |
| TC-05 | Cash purchase persists 16,200 as purchase price and amount due.                                       | Covered by backend pricing tests; no live E2E run |
| TC-06 | Cash and installment purchases persist their separate prices.                                         | Pending live purchase-flow E2E                    |

The initial rerun stopped at an outdated assertion that expected the account to remain in onboarding. The test now accepts the active dashboard path. A first paced demonstration hit the default 30-second Playwright timeout; the visible-run timeout was increased and the recorded rerun passed. Neither harness failure reached a US-06 product assertion.

## Watch or rerun

Set `OPERIA_E2E_PHONE`, `OPERIA_E2E_PASSWORD`, and `OPERIA_E2E_OTP` in the local shell without committing their values. From `Operia_FE`, run:

```powershell
$env:OPERIA_E2E_BROWSER_CHANNEL='chrome'
$env:OPERIA_E2E_SLOW_MO_MS='400'
$env:OPERIA_E2E_VIDEO='1'
npm run test:e2e -- --headed
npx playwright show-report
```

The headed run opens Chrome so the editor steps are visible. The HTML report includes the recorded video for the most recent run.
