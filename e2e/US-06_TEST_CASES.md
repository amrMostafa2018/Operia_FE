# US-06 test cases

Source: `US-06 Cash price and discount.docx`. The Playwright spec signs in to the local development API with credentials supplied through environment variables. A separate development account with the supplied phone, password, and OTP was registered in the isolated `Operia_Dev` database. That account is in onboarding, so the editor checks model an active onboarding status and use a controlled offer API. They verify frontend behavior and request payloads; they do not prove live persistence.

| ID | Scenario | Expected result | Result |
| --- | --- | --- | --- |
| TC-01 | Create a package with cash 18,000, installments 20,000, code CASH10, discount 10%; reopen it. | Both amounts and the code remain independent in the save payload and editor. | Passed in Playwright with controlled offer API |
| TC-02 | Turn off cash while installments stay on; then turn off both. | Installment-only is valid. Both off shows a payment-option error and cannot be saved. | Passed in Playwright with controlled offer API |
| TC-03 | Set cash 18,000 and discount 10% with installments 20,000. | Preview is 16,200; installment amount remains 20,000. | Passed in Playwright |
| TC-04 | Enter a cash price below zero or a percentage above 100. | Inline errors appear and no save request is made. | Passed in Playwright |
| TC-05 | Complete a cash purchase of the discounted offer. | Saved purchase price and amount due are 16,200, calculated once by the server. | Passed in `PackageCashPricingTests`; live E2E pending completed onboarding |
| TC-06 | Complete one cash and one installment purchase of the same offer. | Cash uses 16,200; installment uses its 20,000 plan and is not discounted. | Pending live E2E and US-07/US-14 purchase flow |
| TC-07 | Try an installment-only offer with a zero installment price. | An inline positive-price error appears and save is blocked. | Passed in Playwright |

Run the UI checks with `npx playwright test e2e/us-06.spec.ts` after setting `OPERIA_E2E_PHONE`, `OPERIA_E2E_PASSWORD`, and `OPERIA_E2E_OTP` in the local shell. Do not commit credentials or Playwright storage state.

Verified on 2026-10-29: Playwright 1 test passed with five US-06 steps against the isolated development API for login; 15 focused backend pricing and validator tests passed. The normal development frontend reached the local API through its proxy, and its public plans response matched the direct local API response. The production Angular build contained the hosted API URL; the development build contained `/api` and no hosted API URL.
