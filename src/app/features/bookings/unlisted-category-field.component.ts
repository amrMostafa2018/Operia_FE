import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlContainer,
  FormControl,
  FormGroupDirective,
  ReactiveFormsModule,
} from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs/operators';
import { DropdownModule } from 'primeng/dropdown';
import { PermissionService } from '@core/services/permission.service';
import { Policies } from '@core/models/permissions.model';
import { PackageCategoryOption } from '@app/features/packages/models/package-list.model';
import { PackageService } from '@app/features/packages/package.service';
import {
  applyUnlistedCategoryCreateErrors,
  DEFAULT_UNLISTED_CATEGORY_ICON,
} from './unlisted-package.util';

@Component({
  selector: 'app-unlisted-category-field',
  standalone: true,
  imports: [ReactiveFormsModule, DropdownModule, TranslatePipe],
  templateUrl: './unlisted-category-field.component.html',
  styleUrl: './unlisted-category-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [{ provide: ControlContainer, useExisting: FormGroupDirective }],
  host: {
    class: 'field field-category',
    '[class.error]': '!!categoryError()',
  },
})
export class UnlistedCategoryFieldComponent implements OnInit {
  private readonly packagesApi = inject(PackageService);
  private readonly permissions = inject(PermissionService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly parentForm = inject(FormGroupDirective);

  readonly categoryCreated = output<PackageCategoryOption>();

  private static nextId = 0;
  readonly categoryInputId = `unlisted-category-${++UnlistedCategoryFieldComponent.nextId}`;

  readonly canManage = computed(() => this.permissions.hasPermission(Policies.PackagesManage));
  readonly categories = signal<{ label: string; value: string }[]>([]);
  readonly searchText = signal('');
  readonly saving = signal(false);

  ngOnInit(): void {
    this.loadCategories();
    this.categoryControl.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cdr.markForCheck());
  }

  categoryError(): string | null {
    const control = this.categoryControl;
    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('required')) {
      return 'BOOKINGS.DETAILS.ERRORS.UNLISTED_CATEGORY_REQUIRED';
    }
    if (control.hasError('server')) {
      return String(control.getError('server'));
    }
    return null;
  }

  onFilter(event: { filter?: string }): void {
    this.searchText.set((event.filter ?? '').trim());
  }

  addCategory(): void {
    const name = this.searchText().trim();
    if (!name || this.saving() || !this.canManage()) {
      return;
    }

    if (name.length > 200) {
      const message = this.translate.instant('ERRORS.CATEGORY_NAME_MAX');
      this.categoryControl.setErrors({ ...this.categoryControl.errors, server: message });
      this.categoryControl.markAsTouched();
      return;
    }

    this.saving.set(true);
    this.packagesApi
      .createServiceCategory({ name, icon: DEFAULT_UNLISTED_CATEGORY_ICON })
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: category => {
          this.categories.update(items =>
            items.some(item => item.value === category.id)
              ? items
              : [...items, { label: category.name, value: category.id }]
          );
          this.categoryControl.setValue(category.id);
          this.categoryControl.markAsDirty();
          this.searchText.set('');
          this.categoryCreated.emit(category);
        },
        error: (error: HttpErrorResponse) => {
          applyUnlistedCategoryCreateErrors(this.categoryControl, error, key =>
            this.translate.instant(key)
          );
        },
      });
  }

  private get categoryControl(): FormControl<string | null> {
    return this.parentForm.form.get('serviceCategoryId') as FormControl<string | null>;
  }

  private loadCategories(): void {
    this.packagesApi
      .listServiceCategories()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: categories =>
          this.categories.set(
            categories.map(category => ({
              label: category.name,
              value: category.id,
            }))
          ),
        error: () => this.categories.set([]),
      });
  }
}
