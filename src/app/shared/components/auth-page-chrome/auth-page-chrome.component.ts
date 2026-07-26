import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-auth-page-chrome',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './auth-page-chrome.component.html',
  styleUrl: './auth-page-chrome.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPageChromeComponent {
  readonly topLinkPrefixKey = input<string | null>(null);
  readonly topLinkLabelKey = input<string | null>(null);
  readonly topLinkRoute = input<string | null>(null);
  readonly titleKey = input<string | null>(null);
  readonly subtitleKey = input<string | null>(null);
  readonly titleIcon = input<string | null>(null);
  readonly maxWidth = input<string | null>(null);
  readonly showHeader = input(true);
}
