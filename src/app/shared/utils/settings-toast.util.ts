import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

export function showSettingsSavedToast(
  messageService: MessageService,
  translate: TranslateService
): void {
  messageService.add({
    severity: 'success',
    summary: translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVED_TITLE'),
    detail: translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVED_DETAIL'),
  });
}
