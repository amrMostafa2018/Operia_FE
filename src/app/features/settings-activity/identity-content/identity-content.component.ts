import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgxIntlTelInputModule } from 'ngx-intl-tel-input';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { finalize } from 'rxjs';

import {
  PHONE_INPUT_CSS_CLASS,
  PHONE_INPUT_DEFAULT_COUNTRY,
  PHONE_INPUT_ONLY_COUNTRIES,
} from '@app/shared/constants/phone-input.config';
import { AppConfigService } from '@core/services/app-config.service';
import { resolveUploadUrl } from '@core/utils/resolve-upload-url';
import { getE164PhoneNumber, getPhoneFieldError } from '@app/shared/utils/phone-number.util';
import { MOCK_IDENTITY_PHOTOS, PhotoSlot } from '../models/settings-activity.model';
import {
  IdentitySettingsDto,
  SettingsActivityService,
} from '../services/settings-activity.service';

const MAX_ABOUT_CHARS = 500;
const PRIMARY_IMAGE_MAX = { width: 960, height: 280 };
const SECONDARY_IMAGE_MAX = { width: 240, height: 96 };

function resizeImageFile(file: File, maxWidth: number, maxHeight: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas not supported'));
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL(file.type || 'image/jpeg', 0.9));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image load failed'));
    };

    image.src = objectUrl;
  });
}

const MOCK_EG_PHONE = {
  number: '01012345678',
  internationalNumber: '+20 10 1234 5678',
  nationalNumber: '01012345678',
  e164Number: '+201012345678',
  countryCode: 'EG',
  dialCode: '+20',
};

@Component({
  selector: 'app-identity-content',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
    NgxIntlTelInputModule,
  ],
  templateUrl: './identity-content.component.html',
  styleUrl: './identity-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityContentComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly appConfig = inject(AppConfigService);
  private readonly messageService = inject(MessageService);
  private readonly settingsService = inject(SettingsActivityService);
  private readonly destroyRef = inject(DestroyRef);

  readonly phoneInputCssClass = PHONE_INPUT_CSS_CLASS;
  readonly onlyCountries = PHONE_INPUT_ONLY_COUNTRIES;
  readonly selectedCountryISO = PHONE_INPUT_DEFAULT_COUNTRY;
  readonly maxAboutChars = MAX_ABOUT_CHARS;

  form!: FormGroup;
  aboutCharCount = signal(0);
  saving = signal(false);
  dragOverPhotoId = signal<string | null>(null);

  photos = signal<PhotoSlot[]>(structuredClone(MOCK_IDENTITY_PHOTOS));
  private initialFormValue: Record<string, unknown> = {};
  private initialPhotos: PhotoSlot[] = [];
  private initialVisibleInfo = { mainAddress: '', about: '' };
  private photoDragCounters = new Map<string, number>();

  get acceptedImageAccept(): string {
    return this.appConfig.allowedMimeTypesAccept || 'image/jpeg,image/png,image/webp';
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      activityName: ['', [Validators.required]],
      contactPhone: [MOCK_EG_PHONE.number, [Validators.required]],
      whatsappPhone: [MOCK_EG_PHONE.number],
      email: ['', [Validators.required, Validators.email]],
      mainAddress: ['', [Validators.required]],
      about: ['', [Validators.required, Validators.maxLength(MAX_ABOUT_CHARS)]],
    });

    this.form
      .get('about')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value: string) => this.aboutCharCount.set(value?.length ?? 0));

    this.loadIdentity();
  }

  private loadIdentity(): void {
    this.settingsService
      .getIdentity()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.patchFromDto(res);
        },
        error: () => {
          this.snapshotInitialState();
        },
      });
  }

  private patchFromDto(res: IdentitySettingsDto): void {
    this.form.patchValue({
      activityName: res.activityName || '',
      contactPhone: res.contactPhone || MOCK_EG_PHONE.number,
      whatsappPhone: res.whatsappPhone || MOCK_EG_PHONE.number,
      email: res.email || '',
      mainAddress: res.mainAddress || '',
      about: res.about || '',
    });

    const primaryUrl = res.primaryPhotoUrl
      ? resolveUploadUrl(res.primaryPhotoUrl)
      : '/assets/images/settings-activity/photo-primary.svg';
    const additional = res.additionalPhotoUrls || [];
    const slots: PhotoSlot[] = [
      { id: 'primary', isPrimary: true, previewUrl: primaryUrl, file: null },
      {
        id: 'photo-1',
        isPrimary: false,
        previewUrl: additional[0] ? resolveUploadUrl(additional[0]) : null,
        file: null,
        displayIndex: 2,
      },
      {
        id: 'photo-2',
        isPrimary: false,
        previewUrl: additional[1] ? resolveUploadUrl(additional[1]) : null,
        file: null,
        displayIndex: 3,
      },
      {
        id: 'photo-3',
        isPrimary: false,
        previewUrl: additional[2] ? resolveUploadUrl(additional[2]) : null,
        file: null,
        displayIndex: 4,
      },
      {
        id: 'photo-4',
        isPrimary: false,
        previewUrl: additional[3] ? resolveUploadUrl(additional[3]) : null,
        file: null,
        displayIndex: 5,
      },
      {
        id: 'photo-5',
        isPrimary: false,
        previewUrl: additional[4] ? resolveUploadUrl(additional[4]) : null,
        file: null,
        displayIndex: 6,
      },
    ];
    this.photos.set(slots);
    this.snapshotInitialState();
  }

  getPhoneError(controlName: string): string | null {
    const control = this.form.get(controlName);
    if (!control?.touched || !control.invalid) {
      return null;
    }
    return getPhoneFieldError(control, {
      required: this.translate.instant('ERRORS.PhoneRequired'),
      invalid: this.translate.instant('ERRORS.PhoneInvalid'),
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!(control?.invalid && control.touched);
  }

  isPhoneInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!(control?.invalid && control.touched);
  }

  onPhotoSelected(event: Event, photoId: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.processPhotoFile(file, photoId);
    input.value = '';
  }

  onPhotoDragEnter(event: DragEvent, photoId: string): void {
    event.preventDefault();
    event.stopPropagation();

    const count = (this.photoDragCounters.get(photoId) ?? 0) + 1;
    this.photoDragCounters.set(photoId, count);
    this.dragOverPhotoId.set(photoId);
  }

  onPhotoDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onPhotoDragLeave(event: DragEvent, photoId: string): void {
    event.preventDefault();
    event.stopPropagation();

    const count = (this.photoDragCounters.get(photoId) ?? 1) - 1;
    if (count <= 0) {
      this.photoDragCounters.delete(photoId);
      if (this.dragOverPhotoId() === photoId) {
        this.dragOverPhotoId.set(null);
      }
    } else {
      this.photoDragCounters.set(photoId, count);
    }
  }

  onPhotoDrop(event: DragEvent, photoId: string): void {
    event.preventDefault();
    event.stopPropagation();

    this.photoDragCounters.delete(photoId);
    this.dragOverPhotoId.set(null);

    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.processPhotoFile(file, photoId);
    }
  }

  isPhotoDragOver(photoId: string): boolean {
    return this.dragOverPhotoId() === photoId;
  }

  private processPhotoFile(file: File, photoId: string): void {
    if (!this.appConfig.isAllowedMimeType(file.type)) {
      this.showToast('SETTINGS_ACTIVITY.IDENTITY.PHOTOS.INVALID_TYPE');
      return;
    }

    if (!this.appConfig.isValidFileSize(file.size)) {
      this.showToast('SETTINGS_ACTIVITY.IDENTITY.PHOTOS.INVALID_SIZE');
      return;
    }

    const slot = this.photos().find(photo => photo.id === photoId);
    const limits = slot?.isPrimary ? PRIMARY_IMAGE_MAX : SECONDARY_IMAGE_MAX;

    resizeImageFile(file, limits.width, limits.height)
      .then(previewUrl => {
        this.photos.update(slots =>
          slots.map(item => (item.id === photoId ? { ...item, previewUrl, file } : item))
        );
      })
      .catch(() => {
        this.showToast('SETTINGS_ACTIVITY.IDENTITY.PHOTOS.INVALID_TYPE');
      });
  }

  removePhoto(photoId: string): void {
    this.photos.update(slots =>
      slots.map(slot => (slot.id === photoId ? { ...slot, previewUrl: null, file: null } : slot))
    );
  }

  onPhotoError(photoId: string): void {
    const slot = this.photos().find(p => p.id === photoId);
    if (!slot?.previewUrl) {
      return;
    }

    if (slot.isPrimary) {
      const fallback = '/assets/images/settings-activity/photo-primary.svg';
      if (slot.previewUrl === fallback) {
        return;
      }
      this.photos.update(slots =>
        slots.map(item =>
          item.id === photoId ? { ...item, previewUrl: fallback, file: null } : item
        )
      );
    } else {
      this.photos.update(slots =>
        slots.map(item => (item.id === photoId ? { ...item, previewUrl: null, file: null } : item))
      );
    }
  }

  onResetVisibleInfo(): void {
    this.form.patchValue(this.initialVisibleInfo);
    this.aboutCharCount.set(this.initialVisibleInfo.about.length);
  }

  onReset(): void {
    this.form.reset(this.initialFormValue);
    this.photos.set(structuredClone(this.initialPhotos));
    this.aboutCharCount.set((this.initialFormValue['about'] as string)?.length ?? 0);
  }

  onSave(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const value = this.form.getRawValue();
    const formData = new FormData();
    formData.append('activityName', value.activityName ?? '');
    formData.append('contactPhone', getE164PhoneNumber(value.contactPhone) ?? '');
    formData.append('whatsappPhone', getE164PhoneNumber(value.whatsappPhone) ?? '');
    formData.append('email', value.email ?? '');
    formData.append('mainAddress', value.mainAddress ?? '');
    formData.append('about', value.about ?? '');

    for (const photo of this.photos()) {
      if (photo.file) {
        formData.append(photo.isPrimary ? 'primaryPhoto' : 'additionalPhotos', photo.file);
      } else if (
        photo.previewUrl &&
        !photo.previewUrl.startsWith('data:') &&
        !photo.previewUrl.startsWith('/assets/')
      ) {
        try {
          const urlObj = new URL(photo.previewUrl, window.location.origin);
          formData.append('existingPhotoUrls', urlObj.pathname);
        } catch {
          formData.append('existingPhotoUrls', photo.previewUrl);
        }
      }
    }

    this.saving.set(true);
    this.settingsService
      .updateIdentity(formData)
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: res => {
          this.patchFromDto(res);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVED_TITLE'),
            detail: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVED_DETAIL'),
          });
        },
        error: () => this.showRequestError(),
      });
  }

  primaryPhoto(): PhotoSlot {
    return this.photos().find(p => p.isPrimary) ?? this.photos()[0];
  }

  secondaryPhotos(): PhotoSlot[] {
    return this.photos().filter(p => !p.isPrimary);
  }

  private snapshotInitialState(): void {
    this.initialFormValue = this.form.getRawValue();
    this.initialPhotos = structuredClone(this.photos());
    this.initialVisibleInfo = {
      mainAddress: this.form.get('mainAddress')?.value ?? '',
      about: this.form.get('about')?.value ?? '',
    };
  }

  private showToast(key: string): void {
    this.messageService.add({
      severity: 'warn',
      summary: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVE'),
      detail: this.translate.instant(key),
    });
  }

  private showRequestError(): void {
    this.messageService.add({
      severity: 'error',
      summary: 'Settings',
      detail: 'Unable to save settings.',
    });
  }
}
