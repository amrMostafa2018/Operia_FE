# US-20–US-24 acceptance coverage

This maps the numbered criteria in the updated story documents to executed tests. `E20`–`E24` are the matching `Operia_FE/e2e/us-20.spec.ts` through `us-24.spec.ts`; `Statement`, `Actions` and `Revenue` are the backend test classes `CustomerStatementTests`, `CustomerRefundAndBlockTests` and `ActivityRevenueSummaryTests`. The E2E tests use the reserved local Development tenants, real API and SQL Server. The user's later decision permits one balance type per purchase and applies installment release rules to pulse balances.

| Criterion | Evidence and practical limit |
| --- | --- |
| 20.1 | `Statement.SelectedPurchaseUsesItsOwnPlanAndCollectionsWithinAllowedBranch` checks a pulse balance and three installment rows. Pulse values come from a mocked purchase-details result; a pulse-installment statement has not been tested end to end. |
| 20.2 | E20 and `Statement` check one paid and two due numbered installments. |
| 20.3 | E20 checks both another tenant and another customer in the same tenant cannot read the selected purchase; UI opens the statement from its row. A browser switch between two open statements is not separately tested. |
| 20.4 | `Statement.SelectedPurchaseUsesItsOwnPlanAndCollectionsWithinAllowedBranch` verifies purchase-scoped installment collections and denies another purchase outside branch scope; E20 checks completed execution for the selected purchase. The specific two-purchases/same-offer scenario is not exercised end to end. |
| 20.5 | E20 compares three reservations against one completed execution and checks one used session. |
| 21.1–21.3 | E21 rejects 5,001 of 5,000 and 3,501 after a 1,500 refund; `Actions.RefundUsesPaidCap_AndCancelsFutureBookingOnlyOnce` verifies three used sessions do not reduce the money-based cap. |
| 21.4 | `Actions.HistoryShowsSavedRefundAndBlockTransitionsForSelectedCustomer` checks retained refund and block events; existing sale and collection preservation is checked by `Actions.RefundUsesPaidCap_AndCancelsFutureBookingOnlyOnce`. |
| 21.5 | E21 checks cancellation, reservation release, refund and transactional audit counts; `Actions.RefundUsesPaidCap_AndCancelsFutureBookingOnlyOnce` checks the original collection and used sessions. |
| 21.6 | E21 verifies a blocked customer cannot create a booking, and registers the same mobile in another center without inheriting the block. `Actions.BlockStateIsSeparateFromPurchase_AndAuditsBothTransitions` checks an existing booking remains. A booking at the second center is not separately exercised. |
| 21.7 | `Actions.HistoryShowsSavedRefundAndBlockTransitionsForSelectedCustomer` checks distinct block/unblock events and old/new reasons. |
| 22.1 | E21 checks a newly posted refund's history response contains its actor, timestamp, amount, reason and reference; it also checks persisted audit counts. Actor/time rendering for that entry has not been separately checked in a browser. |
| 22.2 | E22 checks a different customer's history independently and checks tenant scope; browser opens the selected customer's history. |
| 22.3 | E22 checks the API denies Staff without history permission. Visibility of the history menu for Staff is not separately tested in a browser. |
| 22.4 | `Actions.HistoryShowsSavedRefundAndBlockTransitionsForSelectedCustomer` checks two distinct events, state transitions and reason. |
| 22.5 | E22 checks two API pages and the UI page controls; `Actions.HistoryCursorDoesNotRepeatRowsWhenNewAuditArrives` checks no duplication when a new event arrives. |
| 23.1 | `Revenue.CardsCountConfirmedMovementsAndSubtractRefundOnlyFromNet` checks a 5,000 collection; E23 checks real branch collection movements. |
| 23.2–23.4 | E23 records a real 1,500 refund, verifies gross unchanged and net reduced once, and compares dashboard net movement. `Revenue.CardsCountConfirmedMovementsAndSubtractRefundOnlyFromNet` checks the 5,000/1,500/3,500 example. |
| 23.5 | The `Revenue` fixture associates today's refund with a prior-month sale; `CardsCountConfirmedMovementsAndSubtractRefundOnlyFromNet` checks today's gross and net. |
| 24.1–24.2 | E24 checks one installment movement and report totals after the US-23 refund; `Revenue.ExportIncludesAllFilteredRowsAndNumericTotals` checks numeric totals. |
| 24.3 | E24 submits a payment, verifies UnderReview is outside gross, then confirms it concurrently and verifies one collection and audit. |
| 24.4 | E24 inspects the actual API workbook: all report movement IDs and gross, refunds and net totals match the branch-filtered report. The export button itself is not exercised in this suite. |
| 24.5 | `Revenue.ReportDefaultsToCenterMonthAndKeepsFailedAttemptOutOfMoney` checks the default server date range; an initial browser date display check is not included. |
| 24.6 | E24 submits proof to the real API, verifies pending status and revenue, retrieves the proof with the correct permission, and checks staff and cross-tenant denials. A real external payment-provider integration is not part of this application test. |
| 24.7 | E24 checks all branch-filtered report IDs and numeric totals in the actual workbook; `Revenue.ExportIncludesAllFilteredRowsAndNumericTotals` checks numeric amount cells. |
| 24.8 | E24 reads every two-row page and compares IDs, totals and count to the unpaged report; `Revenue.ReportPagesHaveStableUniqueMovementIdsAndRejectOtherBranch` adds handler-level scope checks. |

These tests do not certify every business rule, real payment/refund execution, deployment, browser, accessibility condition or error recovery path. The application records an administrator-confirmed refund movement; no external refund-provider execution was verified.
