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
import { forkJoin } from 'rxjs';
import { LanguageService } from '@core/services/language.service';
import { ActivityRevenueService } from './activity-revenue.service';
import {
  ActivityRevenueSummary,
  InstallmentRevenueRow,
  RevenueBranch,
} from './models/installment-revenue.model';

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
  readonly summary = signal<ActivityRevenueSummary | null>(null);
  readonly branches = signal<RevenueBranch[]>([]);
  readonly branchId = signal<string | null>(null);
  readonly page = signal(1);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly pageCount = computed(() => Math.ceil(this.total() / 20));
  private requestVersion = 0;

  ngOnInit(): void {
    this.service
      .branches()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: branches => this.branches.set(branches),
        error: () => {
          this.toast.add({
            severity: 'error',
            summary: 'OPERIA',
            detail: this.translate.instant('ACTIVITY_REVENUE.LOAD_ERROR'),
          });
        },
      });
    this.load(1);
  }

  load(page: number): void {
    const version = ++this.requestVersion;
    this.loading.set(true);
    this.error.set(false);
    this.summary.set(null);
    forkJoin({
      page: this.service.listCollections(page, this.branchId()),
      summary: this.service.summary(this.branchId()),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          if (version !== this.requestVersion) return;
          this.rows.set(result.page.items);
          this.total.set(result.page.total);
          this.summary.set(result.summary);
          this.page.set(page);
          this.loading.set(false);
        },
        error: () => {
          if (version !== this.requestVersion) return;
          this.rows.set([]);
          this.total.set(0);
          this.summary.set(null);
          this.loading.set(false);
          this.error.set(true);
          this.toast.add({
            severity: 'error',
            summary: 'OPERIA',
            detail: this.translate.instant('ACTIVITY_REVENUE.LOAD_ERROR'),
          });
        },
      });
  }

  selectBranch(value: string): void {
    this.branchId.set(value || null);
    this.load(1);
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
