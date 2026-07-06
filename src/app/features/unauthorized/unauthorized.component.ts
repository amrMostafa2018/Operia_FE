import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink, TranslatePipe, ButtonModule],
  template: `
    <div class="unauthorized">
      <i class="pi pi-lock unauthorized-icon" aria-hidden="true"></i>
      <h1>{{ 'UNAUTHORIZED.TITLE' | translate }}</h1>
      <p>{{ 'UNAUTHORIZED.MESSAGE' | translate }}</p>
      <p-button
        [label]="'UNAUTHORIZED.BACK_TO_DASHBOARD' | translate"
        icon="pi pi-home"
        routerLink="/dashboard"
      />
    </div>
  `,
  styles: `
    .unauthorized {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      gap: 1rem;
      padding: 2rem;
      text-align: center;
    }

    .unauthorized-icon {
      font-size: 3rem;
      color: var(--color-primary, #6366f1);
    }

    h1 {
      margin: 0;
      font-size: 1.75rem;
    }

    p {
      margin: 0;
      color: var(--text-color-secondary, #64748b);
      max-width: 28rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnauthorizedComponent {}
