import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgxIntlTelInputModule } from 'ngx-intl-tel-input';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';

import {
  PHONE_INPUT_CSS_CLASS,
  PHONE_INPUT_DEFAULT_COUNTRY,
  PHONE_INPUT_ONLY_COUNTRIES,
} from '@app/shared/constants/phone-input.config';
import { AppConfigService } from '@core/services/app-config.service';
import { getPhoneFieldError } from '@app/shared/utils/phone-number.util';
import { MOCK_IDENTITY_PHOTOS, PhotoSlot } from '../models/settings-activity.model';

const MAX_ABOUT_CHARS = 500;
const PRIMARY_IMAGE_MAX = { width: 960, height: 280 };
const SECONDARY_IMAGE_MAX = { width: 240, height: 96 };

function resizeImageFile(
  file: File,
  maxWidth: number,
  maxHeight: number
): Promise<string> {
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
    NgxIntlTelInputModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
  ],
  templateUrl: './identity-content.component.html',
  styleUrl: './identity-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityContentComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly appConfig = inject(AppConfigService);

  readonly onlyCountries = PHONE_INPUT_ONLY_COUNTRIES;
  readonly selectedCountryISO = PHONE_INPUT_DEFAULT_COUNTRY;
  readonly phoneInputCssClass = PHONE_INPUT_CSS_CLASS;
  readonly maxAboutChars = MAX_ABOUT_CHARS;
  readonly acceptedImageAccept = this.appConfig.allowedMimeTypesAccept;

  form!: FormGroup;
  photos = signal<PhotoSlot[]>(structuredClone(MOCK_IDENTITY_PHOTOS));
  saving = signal(false);
  aboutCharCount = signal(0);
  dragOverPhotoId = signal<string | null>(null);

  private initialFormValue: Record<string, unknown> = {};
  private initialPhotos: PhotoSlot[] = [];
  private initialVisibleInfo = { mainAddress: '', about: '' };
  private readonly photoDragCounters = new Map<string, number>();

  ngOnInit(): void {
    this.form = this.fb.group({
      activityName: ['عيادات الليزر المتخصصة', Validators.required],
      contactPhone: [MOCK_EG_PHONE, Validators.required],
      whatsappPhone: [MOCK_EG_PHONE],
      email: ['info@laserclinics.com', [Validators.required, Validators.email]],
      mainAddress: ['123 شارع النصر، مدينة نصر، القاهرة', Validators.required],
      about: [
        'نقدم خدمات تجميل متقدمة باستخدام أحدث تقنيات الليزر والعناية بالبشرة، مع فريق طبي متخصص يهتم بكل تفاصيل راحتك ونتائجك.',
        [Validators.required, Validators.maxLength(MAX_ABOUT_CHARS)],
      ],
    });

    this.aboutCharCount.set(this.form.get('about')?.value?.length ?? 0);
    this.form
      .get('about')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value: string) => this.aboutCharCount.set(value?.length ?? 0));

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
          slots.map(item =>
            item.id === photoId ? { ...item, previewUrl, file } : item
          )
        );
      })
      .catch(() => {
        this.showToast('SETTINGS_ACTIVITY.IDENTITY.PHOTOS.INVALID_TYPE');
      });
  }

  removePhoto(photoId: string): void {
    this.photos.update(slots =>
      slots.map(slot =>
        slot.id === photoId
          ? { ...slot, previewUrl: null, file: null }
          : slot
      )
    );
  }

  onPhotoError(photoId: string): void {
    const slot = this.photos().find(p => p.id === photoId);
    if (!slot?.previewUrl) {
      return;
    }

    const fallback = slot.isPrimary
      ? '/assets/images/settings-activity/photo-primary.svg'
      : `/assets/images/settings-activity/photo-${slot.displayIndex}.svg`;

    if (slot.previewUrl === fallback) {
      return;
    }

    this.photos.update(slots =>
      slots.map(item =>
        item.id === photoId ? { ...item, previewUrl: fallback, file: null } : item
      )
    );
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

    this.saving.set(true);
    setTimeout(() => {
      this.snapshotInitialState();
      this.saving.set(false);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVED_TITLE'),
        detail: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVED_DETAIL'),
      });
    }, 400);
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
}
