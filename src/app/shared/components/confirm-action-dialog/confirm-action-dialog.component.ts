import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

@Component({
  selector: 'app-confirm-action-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule, TranslatePipe],
  templateUrl: './confirm-action-dialog.component.html',
  styleUrl: './confirm-action-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmActionDialogComponent {
  readonly visible = input(false);
  readonly headerKey = input.required<string>();
  readonly messageKey = input.required<string>();
  readonly messageParams = input<Record<string, unknown>>({});
  readonly cancelLabelKey = input('EMPLOYEES.CANCEL');
  readonly confirmLabelKey = input.required<string>();
  readonly styleClass = input('confirm-action-dialog');
  readonly width = input('420px');
  readonly useNativeFooterButtons = input(false);
  readonly confirmIcon = input<string | null>(null);

  readonly cancelled = output<void>();
  readonly confirmed = output<void>();
}
