import { HttpParams } from '@angular/common/http';

/** The same local calendar boundaries are sent to dashboard and Activity Revenue. */
export function currentRevenuePeriodParams(): HttpParams {
  const now = new Date();
  const todayFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const monthFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return new HttpParams()
    .set('todayFromUtc', todayFrom.toISOString())
    .set('todayToUtc', todayTo.toISOString())
    .set('monthFromUtc', monthFrom.toISOString())
    .set('monthToUtc', monthTo.toISOString());
}
