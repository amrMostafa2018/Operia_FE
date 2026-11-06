# US-07 Playwright test cases — installment plan and session release

Source: `OPERIA_AdminPortal_Updated_Stories/OPERIA_AdminPortal_Updated_Stories/US-07 Installment plan and session release.docx`, with the recorded decisions in `requirements/OPERIA_REQUIREMENTS_INDEX.md`. These are test cases to automate; no result is claimed here.

## Test setup

- Use an authenticated center admin with permission to manage package offers. Run writes against an isolated development tenant and database, never the production API. Create a fresh offer for each case or reset the fixture between cases.
- Start from **Add Service or Offer** (`/packages`), choose **Package**, and select a valid service category. Use cash price **18,000**, installment price **20,000**, and **All staff** unless the case overrides them.
- For editor cases, Playwright may control the category and offer API responses, as in `us-06.spec.ts`. Assert both the visible editor state and the outgoing create/update request. For persistence, tenant isolation, and payment cases, use a real test API and database; a mocked offer response cannot prove those outcomes.
- Treat the first payment as separate from numbered installments. A plan save alone must not create a payment or release a purchased session. A released session becomes available; only performing a session consumes it.

## Offer editor and validation

| ID | Acceptance criterion | Steps and data | Playwright assertions |
| --- | --- | --- | --- |
| TC-01 | AC1 | Create a 10-session package. Enable installments; set first payment **5,000**, count **3**, and row amounts **5,000 / 5,000 / 5,000** with releases **3 / 4 / 3**. Save and reopen. | The grid has exactly three numbered rows. The request contains first payment separately and the three ordered rows. Save succeeds; readback shows amounts, newly released sessions, and cumulative availability **3 / 7 / 10**. Cash price remains **18,000** and installment price **20,000**. |
| TC-02 | AC6 | Set row amounts **4,000 / 6,000 / 5,000**, keeping first payment **5,000** and installment price **20,000**. Save and reopen. | Unequal nonnegative amounts totaling **15,000** are accepted and persist in the same order; the first payment is not counted as a numbered row. |
| TC-03 | AC2, AC6 | Change the rows to **4,000 / 5,000 / 5,000** and click Save. | An inline plan-total error appears; the editor remains open and no create/update request is sent. If calling the API directly, it rejects the invalid total and stores no offer change. |
| TC-04 | AC1, AC2 | Enable installments with a missing first payment, zero installment count, or a count that differs from the number of rows. Try Save for each state. | Each invalid state has an inline error and is blocked. The submitted payload, when valid, has exactly the declared number of ordered rows. |
| TC-05 | AC2, AC6 | Enter a negative row amount, an amount with more than two decimal places, a negative first payment, or a first payment greater than the installment price. | Save is blocked with the relevant inline amount or first-payment error. Direct API requests are rejected as well. A zero row amount remains valid when the total still balances. |
| TC-06 | Business rule | With a valid plan visible, change installment price from **20,000** to **21,000**. Use **Suggest distribution**, then manually edit a row. | The remaining balance becomes **16,000** and the grid recalculates to that balance before save. The suggestion is editable; the manually entered distribution is submitted rather than silently replaced on Save. |
| TC-07 | AC3 | Create a **Single session** offer, then attempt to enable installments. Also switch an edited package with a plan to Single session and accept the in-app replacement dialog. | The installment price, first payment, count, and grid are absent for Single session. The saved payload has installments disabled and no plan rows. Reopening the offer does not restore the old plan. |
| TC-08 | Business rule | For a package, enter row releases whose running total exceeds the package's session count, or enter a negative or fractional release. | An inline session-allocation error appears and no save request is sent. Direct API requests are rejected. A row releasing **0** sessions is allowed. |

## Release ceiling and payment outcomes

| ID | Acceptance criterion | Steps and data | Playwright assertions |
| --- | --- | --- | --- |
| TC-09 | AC4 | For **10 sessions**, first payment **5,000**, and three **5,000** rows, try releases **8 / 0 / 2**. Then use **3 / 4 / 3**. | The first plan is rejected because eight sessions would be available before full payment. The second plan saves because the prepayment cumulative release is at most **7**. After confirmed final payment, all **10** are available. |
| TC-10 | AC5 | For **15 sessions**, try a plan releasing **11** sessions before full payment, then a plan releasing **10** before full payment. | Eleven is rejected; ten is accepted. The **10.5** ceiling rounds down to **10**, not up to 11. |
| TC-11 | Recorded one-session decision | Create a package with exactly **1** session and a valid installment schedule. Try to release that session on a row that does not settle the balance. | The early release is rejected even though 70% would round to one. The sole session becomes available only when the purchase is fully paid. |
| TC-12 | AC4, AC7 | Sell a valid installment package through a confirmed first-payment sale. Inspect the purchased entitlement. Make one confirmed numbered payment; inspect it again. Complete any sessions required by the next-payment eligibility rule, then make the final confirmed payment. | The first payment releases **0** planned sessions unless it settles the entire price. Each confirmed numbered payment adds only its saved row's newly released sessions. When the balance reaches zero, remaining sessions are released once; available sessions never exceed the purchased total. Performing a session reduces remaining usable sessions without changing the historical release count. |
| TC-13 | AC7 | Against a purchase with an unpaid next installment, record a failed payment attempt. Then submit a confirmed payment with one idempotency key and repeat that same request/key. Read the purchase after each action. | Failure leaves paid amount and released sessions unchanged. The confirmed request releases the assigned sessions once. Repeating it returns the existing result or equivalent state and adds no collection, paid amount, or sessions. |
| TC-14 | Business rule | Save or update a package plan without selling it or recording payment. | No customer entitlement, collection, or released-session balance is created merely by configuring the offer. |
| TC-15 | Tenant isolation | Create a plan under tenant A. Authenticate as tenant B and request tenant A's offer ID or attempt to update it. | Tenant B cannot read or change the plan. Tenant A's plan remains unchanged. |

## Automation notes

- Give each case its own package name/ID and assert the API request body as well as the UI result. For blocked saves, count create/update requests before and after clicking Save.
- Read the saved offer from the API after a successful create/update; reopening a Playwright-mocked editor only proves frontend readback.
- For collection cases, use the saved purchase plan snapshot. Complete the prior released sessions when the next installment requires them; do not bypass that eligibility rule to reach the final payment.
- Exercise both Arabic and English inline messages for validation cases when practical. Match translated messages or stable error codes rather than relying on visual position alone.
- Keep credentials, OTP values, and Playwright storage state out of Git. Run the existing harness with `npm run test:e2e` after implementing `e2e/us-07.spec.ts` from these cases.
