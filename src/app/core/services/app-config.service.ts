import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface FileStorageConfig {
  maxFileSizeBytes: number;
  allowedMimeTypes: string[];
}

export interface AppSettings {
  fileStorage: FileStorageConfig;
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  fileStorage: {
    maxFileSizeBytes: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
};

@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly http = inject(HttpClient);
  private settings: AppSettings = DEFAULT_APP_SETTINGS;

  async init(): Promise<void> {
    try {
      const loaded = await firstValueFrom(
        this.http.get<AppSettings>('/assets/appsettings.json')
      );

      this.settings = {
        fileStorage: {
          ...DEFAULT_APP_SETTINGS.fileStorage,
          ...loaded.fileStorage,
        },
      };
    } catch {
      this.settings = DEFAULT_APP_SETTINGS;
    }
  }

  get fileStorage(): FileStorageConfig {
    return this.settings.fileStorage;
  }

  get allowedMimeTypesAccept(): string {
    return this.settings.fileStorage.allowedMimeTypes.join(',');
  }

  isAllowedMimeType(mimeType: string): boolean {
    return this.settings.fileStorage.allowedMimeTypes.includes(mimeType);
  }

  isValidFileSize(size: number): boolean {
    return size <= this.settings.fileStorage.maxFileSizeBytes;
  }
}
