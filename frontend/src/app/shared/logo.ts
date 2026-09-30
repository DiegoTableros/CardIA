import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex items-center gap-2.5' },
  template: `
    <span class="relative grid place-items-center rounded-xl bg-gradient-to-br from-brand-500 via-hot-500 to-accent-500 shadow-(--shadow-glow)" [style.width.px]="size()" [style.height.px]="size()">
      <svg viewBox="0 0 24 24" [style.width.px]="size() * 0.58" [style.height.px]="size() * 0.58" fill="none" stroke="white" stroke-width="2" stroke-linecap="round">
        <rect x="3" y="6" width="18" height="12" rx="2.5" />
        <path d="M3 10h18" />
        <path d="M14.5 14.5h3" />
        <circle cx="7.5" cy="14.5" r="1" fill="white" />
      </svg>
    </span>
    @if (showText()) {
      <span class="font-display text-xl font-bold tracking-tight text-white">Card<span class="gradient-text">IA</span></span>
    }
  `,
})
export class Logo {
  readonly size = input(34);
  readonly showText = input(true);
}
