import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-settings-footer',
  standalone: true,
  imports: [ButtonModule, TranslatePipe],
  templateUrl: './settings-footer.component.html',
  styleUrl: './settings-footer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsFooterComponent {
  showReset = input(true);
  noteKey = input<string | null>(null);
  saving = input(false);

  reset = output<void>();
  save = output<void>();
}
