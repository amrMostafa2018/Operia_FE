import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';

import { showSettingsSavedToast } from '@app/shared/utils/settings-toast.util';
import { SettingsFooterComponent } from '../components/settings-footer/settings-footer.component';
import {
  MOCK_BANK_OPTIONS,
  MOCK_PAYMENT_METHODS,
  MOCK_WALLET_OPTIONS,
  PaymentMethodId,
  PaymentMethodState,
} from '../models/settings-activity.model';
import { PaymentMethodsDto, SettingsActivityService } from '../services/settings-activity.service';

@Component({
  selector: 'app-payment-methods',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    ButtonModule,
    DropdownModule,
    InputSwitchModule,
    InputTextModule,
    InputTextareaModule,
    SettingsFooterComponent,
  ],
  templateUrl: './payment-methods.component.html',
  styleUrl: './payment-methods.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMethodsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly settingsService = inject(SettingsActivityService);
  private readonly destroyRef = inject(DestroyRef);

  paymentMethods = signal<PaymentMethodState[]>(structuredClone(MOCK_PAYMENT_METHODS));
  expandedIds = signal<Set<PaymentMethodId>>(
    new Set(['bank_transfer', 'instapay', 'e_wallet', 'fawry'])
  );
  saving = signal(false);

  private readonly detailsOrder: PaymentMethodId[] = [
    'bank_transfer',
    'instapay',
    'e_wallet',
    'fawry',
    'cash',
  ];

  bankOptions = MOCK_BANK_OPTIONS;
  walletOptions = MOCK_WALLET_OPTIONS;

  bankForm!: FormGroup;
  instapayForm!: FormGroup;
  walletForm!: FormGroup;
  fawryForm!: FormGroup;

  private initialState: Record<string, unknown> = {};

  ngOnInit(): void {
    this.bankForm = this.fb.group({
      bank: ['nbe', Validators.required],
      accountHolder: ['', Validators.required],
      accountNumber: ['', Validators.required],
      iban: [''],
    });

    this.instapayForm = this.fb.group({
      instapayId: ['', Validators.required],
      accountHolder: ['', Validators.required],
    });

    this.walletForm = this.fb.group({
      walletType: ['vodafone', Validators.required],
      holderName: ['', Validators.required],
      walletNumber: ['', Validators.required],
    });

    this.fawryForm = this.fb.group({
      serviceCode: ['', Validators.required],
      notes: [''],
    });

    this.loadPaymentMethods();
  }

  private loadPaymentMethods(): void {
    this.settingsService
      .getPaymentMethods()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.paymentMethods.update(methods =>
            methods.map(m => {
              if (m.id === 'cash') return { ...m, enabled: res.cashEnabled };
              if (m.id === 'bank_transfer') return { ...m, enabled: res.bankTransferEnabled };
              if (m.id === 'instapay') return { ...m, enabled: res.instapayEnabled };
              if (m.id === 'e_wallet') return { ...m, enabled: res.eWalletEnabled };
              if (m.id === 'fawry') return { ...m, enabled: res.fawryEnabled };
              return m;
            })
          );

          this.bankForm.patchValue({
            bank: res.bank || 'nbe',
            accountHolder: res.bankAccountHolder || '',
            accountNumber: res.bankAccountNumber || '',
            iban: res.iban || '',
          });
          this.instapayForm.patchValue({
            instapayId: res.instapayId || '',
            accountHolder: res.instapayAccountHolder || '',
          });
          this.walletForm.patchValue({
            walletType: res.walletType || 'vodafone',
            holderName: res.walletHolderName || '',
            walletNumber: res.walletNumber || '',
          });
          this.fawryForm.patchValue({
            serviceCode: res.fawryServiceCode || '',
            notes: res.fawryNotes || '',
          });

          this.snapshotInitialState();
        },
        error: () => {
          this.snapshotInitialState();
        },
      });
  }

  isEnabled(id: PaymentMethodId): boolean {
    return this.paymentMethods().find(m => m.id === id)?.enabled ?? false;
  }

  toggleMethod(id: PaymentMethodId, enabled: boolean): void {
    this.paymentMethods.update(methods => methods.map(m => (m.id === id ? { ...m, enabled } : m)));

    if (!enabled) {
      this.expandedIds.update(set => {
        const next = new Set(set);
        next.delete(id);
        return next;
      });
    }
  }

  isExpanded(id: PaymentMethodId): boolean {
    return this.expandedIds().has(id);
  }

  toggleExpanded(id: PaymentMethodId): void {
    if (!this.isEnabled(id)) {
      return;
    }
    this.expandedIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  onHeaderSwitchClick(event: Event): void {
    event.stopPropagation();
  }

  getFormForMethod(id: PaymentMethodId): FormGroup | null {
    switch (id) {
      case 'bank_transfer':
        return this.bankForm;
      case 'instapay':
        return this.instapayForm;
      case 'e_wallet':
        return this.walletForm;
      case 'fawry':
        return this.fawryForm;
      default:
        return null;
    }
  }

  isInvalid(form: FormGroup, controlName: string): boolean {
    const control = form.get(controlName);
    return !!(control?.invalid && control.touched);
  }

  getFieldError(form: FormGroup, controlName: string): string | null {
    const control = form.get(controlName);
    if (!control?.touched || !control.invalid) {
      return null;
    }
    if (control.errors?.['required']) {
      switch (controlName) {
        case 'bank':
        case 'walletType':
          return this.translate.instant('ERRORS.FieldRequired');
        case 'accountHolder':
        case 'holderName':
          return this.translate.instant('ERRORS.AccountHolderRequired');
        case 'accountNumber':
          return this.translate.instant('ERRORS.AccountNumberRequired');
        case 'instapayId':
          return this.translate.instant('ERRORS.InstapayIdRequired');
        case 'walletNumber':
          return this.translate.instant('ERRORS.WalletNumberRequired');
        case 'serviceCode':
          return this.translate.instant('ERRORS.ServiceCodeRequired');
        default:
          return this.translate.instant('ERRORS.FieldRequired');
      }
    }
    return null;
  }

  detailsMethods(): PaymentMethodState[] {
    return this.detailsOrder
      .map(id => this.paymentMethods().find(method => method.id === id))
      .filter((method): method is PaymentMethodState => !!method && method.enabled);
  }

  onReset(): void {
    if (this.initialState['methods']) {
      this.paymentMethods.set(
        structuredClone(this.initialState['methods'] as PaymentMethodState[])
      );
    } else {
      this.paymentMethods.set(structuredClone(MOCK_PAYMENT_METHODS));
    }
    this.expandedIds.set(new Set(['bank_transfer', 'instapay', 'e_wallet', 'fawry']));
    if (this.initialState['bank']) this.bankForm.reset(this.initialState['bank'] as object);
    if (this.initialState['instapay'])
      this.instapayForm.reset(this.initialState['instapay'] as object);
    if (this.initialState['wallet']) this.walletForm.reset(this.initialState['wallet'] as object);
    if (this.initialState['fawry']) this.fawryForm.reset(this.initialState['fawry'] as object);
  }

  onSave(): void {
    if (!this.paymentMethods().some((method) => method.enabled)) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVE'),
        detail: this.translate.instant('SETTINGS_ACTIVITY.PAYMENTS.VALIDATION.AT_LEAST_ONE'),
      });
      return;
    }

    const forms = [this.bankForm, this.instapayForm, this.walletForm, this.fawryForm];
    let valid = true;

    for (const form of forms) {
      if (this.isFormActive(form) && form.invalid) {
        form.markAllAsTouched();
        valid = false;
      }
    }

    if (!valid) {
      return;
    }

    this.saving.set(true);

    const payload: PaymentMethodsDto = {
      cashEnabled: this.isEnabled('cash'),
      bankTransferEnabled: this.isEnabled('bank_transfer'),
      bank: this.bankForm.value.bank,
      bankAccountHolder: this.bankForm.value.accountHolder,
      bankAccountNumber: this.bankForm.value.accountNumber,
      iban: this.bankForm.value.iban,
      instapayEnabled: this.isEnabled('instapay'),
      instapayId: this.instapayForm.value.instapayId,
      instapayAccountHolder: this.instapayForm.value.accountHolder,
      eWalletEnabled: this.isEnabled('e_wallet'),
      walletType: this.walletForm.value.walletType,
      walletHolderName: this.walletForm.value.holderName,
      walletNumber: this.walletForm.value.walletNumber,
      fawryEnabled: this.isEnabled('fawry'),
      fawryServiceCode: this.fawryForm.value.serviceCode,
      fawryNotes: this.fawryForm.value.notes,
    };

    this.settingsService
      .updatePaymentMethods(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          this.saving.set(false);
          this.paymentMethods.update(methods =>
            methods.map(m => {
              if (m.id === 'cash') return { ...m, enabled: res.cashEnabled };
              if (m.id === 'bank_transfer') return { ...m, enabled: res.bankTransferEnabled };
              if (m.id === 'instapay') return { ...m, enabled: res.instapayEnabled };
              if (m.id === 'e_wallet') return { ...m, enabled: res.eWalletEnabled };
              if (m.id === 'fawry') return { ...m, enabled: res.fawryEnabled };
              return m;
            })
          );
          this.snapshotInitialState();
          showSettingsSavedToast(this.messageService, this.translate);
        },
        error: () => {
          this.saving.set(false);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('SETTINGS_ACTIVITY.FOOTER.SAVE'),
            detail: 'Failed to save payment methods.',
          });
        },
      });
  }

  private isFormActive(form: FormGroup): boolean {
    if (form === this.bankForm) return this.isEnabled('bank_transfer');
    if (form === this.instapayForm) return this.isEnabled('instapay');
    if (form === this.walletForm) return this.isEnabled('e_wallet');
    if (form === this.fawryForm) return this.isEnabled('fawry');
    return false;
  }

  private snapshotInitialState(): void {
    this.initialState = {
      methods: structuredClone(this.paymentMethods()),
      bank: this.bankForm.getRawValue(),
      instapay: this.instapayForm.getRawValue(),
      wallet: this.walletForm.getRawValue(),
      fawry: this.fawryForm.getRawValue(),
    };
  }
}
