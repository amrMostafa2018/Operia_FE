import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { LanguageService } from '@core/services/language.service';
import { ActivityRevenueService } from './activity-revenue.service';
import { InstallmentRevenueRow } from './models/installment-revenue.model';

@Component({
  selector: 'app-activity-revenue',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './activity-revenue.component.html',
  styleUrl: './activity-revenue.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityRevenueComponent implements OnInit {
  private readonly service = inject(ActivityRevenueService);
  private readonly language = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly toast = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly rows = signal<InstallmentRevenueRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly pageCount = computed(() => Math.ceil(this.total() / 20));

  ngOnInit(): void {
    this.load(1);
  }

  load(page: number): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.service
      .listInstallmentCollections(page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.rows.set(result.items);
          this.total.set(result.total);
          this.page.set(page);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.add({
            severity: 'error',
            summary: 'OPERIA',
            detail: this.translate.instant('ACTIVITY_REVENUE.LOAD_ERROR'),
          });
        },
      });
  }

  formatMoney(amount: number): string {
    return new Intl.NumberFormat(this.language.currentLang() === 'ar' ? 'ar-EG' : 'en-EG', {
      style: 'currency',
      currency: 'EGP',
    }).format(amount);
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString(this.language.currentLang() === 'ar' ? 'ar-EG' : 'en-GB');
  }
}
