# US-12–US-18 acceptance coverage

Reviewed against the seven current story documents and the later direct-customer decision in the requirements index. The IDs below follow the numbered acceptance criteria in each story. Tests are in the active `Operia` and `Operia_FE` checkouts. A passing test is evidence for the stated scenario, not proof of every possible input, permission combination, provider outcome or deployed environment.

`E12`–`E18` refer to `Operia_FE/e2e/us-12.spec.ts` through `us-18.spec.ts`. `Sales` refers to `Operia/Operia.Application.Tests/Sales/ConfirmSaleHandlerTests.cs`; `Grid` refers to `Operia/Operia.Application.Tests/Customers/CustomerOperationsTests.cs`. The browser suites use real API calls and the reserved local SQL Server fixtures unless explicitly described otherwise.

| Criterion | Evidence and scope |
| --- | --- |
| 12.1 | E12 UI and mixed quote: 500 installment plus 300 service equals 800 due now. |
| 12.2 | E12 mixed quote and snapshot: unlisted service saved on sale and absent from catalog. |
| 12.3 | E12 UI: removing the cash row changes due now and does not delete an existing confirmed collection or save the draft. |
| 12.4 | E12 stale offer: disabled after quote, confirmation refused, no sale or audit. |
| 12.5 | E12 mixed sale: catalog change leaves the saved snapshot unchanged and the customer operations report retains the sale-time name and amount. |
| 13.1 | E13: direct service sales save without a personal mobile. |
| 13.2 | E13: two separate sales appear in the one direct ledger; SQL checks one anonymous customer. |
| 13.3 | E13 browser customer-mode switch clears the selected registered customer. |
| 13.4 | E13 owned-balance quote is refused. The later user decision permits a fully collected income-only direct package without ownership or booking. |
| 13.5 | E13 browser switch back requires customer selection again. |
| 14.1 | E14 first installment collection verifies only 500 is collected; Sales `FailedThenConfirmedCollection_UsesSavedTermsAndCountsOnlyReceivedAmount` checks dashboard and activity revenue before and after collection. Amounts are scaled fixtures. |
| 14.2 | E14 service installment rejection; Sales `SingleSessionInstallment_IsRejectedBeforeSaleOrCollection`. |
| 14.3 | Sales `FailedThenConfirmedCollection_UsesSavedTermsAndCountsOnlyReceivedAmount` checks zero dashboard revenue and no saved sale after quoting, and zero while confirmed but uncollected. |
| 14.4 | E14 failed payment records zero collection and no purchase, then a later attempt succeeds. |
| 14.5 | Sales `Close_AfterCollectionKeepsSaleWithoutAppointment`; E13 income-only Close also verifies no booking or purchase. |
| 14.6 | E14 Later sale stays pending before collection and becomes ready to book after collection, with no booking. |
| 14.7 | E14 occupied-slot recovery preserves the confirmed collection; Sales `BookNow_ConflictKeepsCollectionAndRetryCreatesOneBooking` checks subsequent retry. |
| 15.1 | E15 browser selects a branch, compares calendar date, time, employee and branch to the dialog, and checks customer selection leaves the context unchanged. |
| 15.2 | E15 direct booking uses no personal fields or owned package. |
| 15.3 | E15 selects an owned package in the browser, switches to direct customer and checks the package is cleared; the API separately rejects a direct booking containing an owned package. |
| 15.4 | E15 registration API rejects a normalized duplicate and SQL confirms one customer. |
| 15.5 | E15 invalid registration and missing customer booking leave no customer or booking. |
| 16.1 | E16 rejects a 60-minute interval for items requiring longer. |
| 16.2 | E16 assigned-offer employee list excludes the unavailable worker. |
| 16.3 | E16 unassigned offer returns the two eligible active workers. |
| 16.4 | E16 simultaneous confirmations yield one booking and one conflict. |
| 16.5 | E16 checks the new branch employee list and rejects the previous branch's employee; `appointments.component.spec.ts` checks the calendar clears its employee selection. |
| 17.1 | E17 owned-session booking persists zero price and reserves without using the session. |
| 17.2 | Sales `InstallmentFirstPayment_UsesSavedPlanAndKeepsUnreleasedSessionUnbooked` verifies saved first payment, purchase balance and release restriction. |
| 17.3 | E17 failed collection leaves no paid booking. |
| 17.4 | E17 verifies booked status with unchanged used balance and one reservation. |
| 17.5 | E17 failed collection cannot book and creates no purchase or booking. |
| 17.6 | E17 forwards a successful collection through a proxy that drops the response, verifies server state, retries the same collection, then books twice; SQL confirms one collection and one booking. This tests a lost response after server completion, not every possible provider-side unknown outcome. |
| 18.1 | E18 filters the API and browser grid by mobile, downloads the filtered workbook and checks both matching worksheet rows. |
| 18.2 | Grid `GridAndExportShareFilteredBalancesAndKeepStatusesSeparate` verifies 5,000 collected and 15,000 remaining on 20,000. |
| 18.3 | E18 clicks the actual export button and checks the filtered workbook's row count and customer/mobile; Grid `ExportIncludesEveryMatchingRowBeyondTheGridPage` verifies export beyond the page. |
| 18.4 | Grid `GridAndExportShareFilteredBalancesAndKeepStatusesSeparate` verifies blocked customer, active purchase, partial payment and due installment independently. |
| 18.5 | Grid `GridAndExportShareFilteredBalancesAndKeepStatusesSeparate` inspects Excel XML for text mobile with leading zero, numeric amounts and styled numeric date; `MobileAndDateFiltersUseTheSavedLocalDayInGridAndExport` verifies the date value. |

The tests do not prove behavior for real third-party payment-provider uncertainty. Existing skipped booking tests describe superseded pre-collection behavior and are not counted as passing coverage.

The additional `Operia_FE/e2e/us-12-18-security-concurrency.spec.ts` scenarios exercise unauthenticated and Staff denial, cross-tenant sale denial, concurrent confirmation and collection idempotency, unlisted-service validation boundaries and combined customer-grid filters. These use the local seeded API and SQL Server, not an external payment provider. The full backend suite also has an opt-in SQL rollback test unrelated to these stories; its default skipped status is not counted as a pass.
