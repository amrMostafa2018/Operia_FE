import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

/** Explains why the selected interval cannot hold all chosen items. */
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
  readonly confirmLabelKey = input('BOOKINGS.MISMATCH.CONFIRM');
  readonly confirming = input(false);

  readonly back = output<void>();
  readonly confirmAnyway = output<void>();
  readonly closed = output<void>();

  close(): void {
    this.closed.emit();
  }
}
