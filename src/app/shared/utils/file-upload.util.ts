import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';

import { AppConfigService } from '@core/services/app-config.service';

export interface FileValidationResult {
  valid: boolean;
  errorKey?: string;
}

export function validateUploadFile(
  file: File,
  appConfig: AppConfigService
): FileValidationResult {
  if (!appConfig.isAllowedMimeType(file.type)) {
    return { valid: false, errorKey: 'SETTINGS_ACTIVITY.IDENTITY.PHOTOS.INVALID_TYPE' };
  }

  if (!appConfig.isValidFileSize(file.size)) {
    return { valid: false, errorKey: 'SETTINGS_ACTIVITY.IDENTITY.PHOTOS.INVALID_SIZE' };
  }

  return { valid: true };
}

export function showUploadValidationToast(
  messageService: MessageService,
  translate: TranslateService,
  errorKey: string
): void {
  messageService.add({
    severity: 'warn',
    summary: translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVE'),
    detail: translate.instant(errorKey),
  });
}
