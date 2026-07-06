import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-feature-placeholder',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="placeholder">
      <i class="pi pi-clock placeholder-icon" aria-hidden="true"></i>
      <h1>{{ featureTitleKey() | translate }}</h1>
      <p>{{ 'FEATURE_PLACEHOLDER.MESSAGE' | translate }}</p>
    </div>
  `,
  styles: `
    .placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 50vh;
      gap: 0.75rem;
      padding: 2rem;
      text-align: center;
    }

    .placeholder-icon {
      font-size: 2.5rem;
      color: var(--color-primary, #6366f1);
    }

    h1 {
      margin: 0;
      font-size: 1.5rem;
    }

    p {
      margin: 0;
      color: var(--text-color-secondary, #64748b);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturePlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  featureTitleKey(): string {
    return (this.route.snapshot.data['featureKey'] as string) ?? 'FEATURE_PLACEHOLDER.TITLE';
  }
}
