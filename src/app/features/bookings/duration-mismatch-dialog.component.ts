import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-duration-mismatch-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule, TranslatePipe],
  templateUrl: './duration-mismatch-dialog.component.html',
  styleUrl: './duration-mismatch-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DurationMismatchDialogComponent {
  readonly visible = input(false);
  readonly serviceDuration = input(0);
  readonly slotDuration = input(0);

  readonly back = output<void>();
  readonly confirmAnyway = output<void>();
}
