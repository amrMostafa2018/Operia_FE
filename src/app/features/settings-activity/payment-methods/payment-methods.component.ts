import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
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

import { SettingsFooterComponent } from '../components/settings-footer/settings-footer.component';
import {
  MOCK_BANK_OPTIONS,
  MOCK_PAYMENT_METHODS,
  MOCK_WALLET_OPTIONS,
  PaymentMethodId,
  PaymentMethodState,
} from '../models/settings-activity.model';

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

  paymentMethods = signal<PaymentMethodState[]>(structuredClone(MOCK_PAYMENT_METHODS));
  expandedIds = signal<Set<PaymentMethodId>>(new Set(['bank_transfer', 'instapay', 'e_wallet', 'fawry']));
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
      accountHolder: ['أحمد محمد', Validators.required],
      accountNumber: ['1234567890', Validators.required],
      iban: [''],
    });

    this.instapayForm = this.fb.group({
      instapayId: ['01012345678', Validators.required],
      accountHolder: ['عيادات الليزر المتخصصة', Validators.required],
    });

    this.walletForm = this.fb.group({
      walletType: ['vodafone', Validators.required],
      holderName: ['أحمد محمد', Validators.required],
      walletNumber: ['01012345678', Validators.required],
    });

    this.fawryForm = this.fb.group({
      serviceCode: ['12345', Validators.required],
      notes: [''],
    });

    this.snapshotInitialState();
  }

  isEnabled(id: PaymentMethodId): boolean {
    return this.paymentMethods().find(m => m.id === id)?.enabled ?? false;
  }

  toggleMethod(id: PaymentMethodId, enabled: boolean): void {
    this.paymentMethods.update(methods =>
      methods.map(m => (m.id === id ? { ...m, enabled } : m))
    );

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

  detailsMethods(): PaymentMethodState[] {
    return this.detailsOrder
      .map(id => this.paymentMethods().find(method => method.id === id))
      .filter((method): method is PaymentMethodState => !!method && method.enabled);
  }

  onReset(): void {
    this.paymentMethods.set(structuredClone(MOCK_PAYMENT_METHODS));
    this.expandedIds.set(new Set(['bank_transfer', 'instapay', 'e_wallet', 'fawry']));
    this.bankForm.reset(this.initialState['bank'] as object);
    this.instapayForm.reset(this.initialState['instapay'] as object);
    this.walletForm.reset(this.initialState['wallet'] as object);
    this.fawryForm.reset(this.initialState['fawry'] as object);
  }

  onSave(): void {
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
