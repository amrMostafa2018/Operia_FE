import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** Covers a parent region with a bilingual spinner while an API call is in flight. */
@Component({
  selector: 'app-busy-overlay',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './busy-overlay.component.html',
  styleUrl: './busy-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusyOverlayComponent {
  readonly visible = input(false);
}
