import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { CurrencyService } from '@core/services/currency.service';

/** Nested add/edit dialog for a one-off unlisted service (name, price, duration). */
@Component({
  selector: 'app-unlisted-service-dialog',
  standalone: true,
  imports: [DialogModule, InputNumberModule, InputTextModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './unlisted-service-dialog.component.html',
  styleUrl: './unlisted-service-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnlistedServiceDialogComponent {
  readonly currencyService = inject(CurrencyService);

  readonly visible = input(false);
  readonly editing = input(false);
  readonly saving = input(false);
  readonly form = input.required<FormGroup>();
  readonly dialogClass = input('');
  readonly idPrefix = input('unlisted');
  readonly nameError = input<string | null>(null);
  readonly priceError = input<string | null>(null);
  readonly durationError = input<string | null>(null);
  readonly errorsAreTranslated = input(false);
  readonly priceLabelKey = input('BOOKINGS.BOOK.TOTAL_PRICE');
  readonly headerKey = input<string | null>(null);
  readonly submitLabelKey = input<string | null>(null);

  readonly closed = output<void>();
  readonly submitted = output<void>();

  readonly resolvedHeaderKey = computed(
    () =>
      this.headerKey() ??
      (this.editing() ? 'SALE_BUILDER.EDIT_UNLISTED' : 'BOOKINGS.DETAILS.ADD_UNLISTED')
  );
  readonly resolvedSubmitLabelKey = computed(
    () => this.submitLabelKey() ?? (this.editing() ? 'COMMON.SAVE' : 'COMMON.ADD')
  );
  readonly styleClass = computed(() => `unlisted-service-dialog ${this.dialogClass()}`.trim());

  nameId(): string {
    return `${this.idPrefix()}-name`;
  }

  priceId(): string {
    return `${this.idPrefix()}-price`;
  }

  durationId(): string {
    return `${this.idPrefix()}-duration`;
  }

  visibilityChanged(visible: boolean): void {
    if (!visible) {
      this.closed.emit();
    }
  }

  submit(): void {
    if (this.saving()) {
      return;
    }
    this.submitted.emit();
  }
}
