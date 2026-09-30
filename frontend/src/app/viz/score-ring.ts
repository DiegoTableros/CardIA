import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-score-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 44 44" [style.width.px]="size()" [style.height.px]="size()" role="img" [attr.aria-label]="'Afinidad ' + value() + ' de 100'">
      <circle cx="22" cy="22" r="18" fill="none" stroke="rgb(255 255 255 / .08)" stroke-width="4" />
      <circle
        cx="22"
        cy="22"
        r="18"
        fill="none"
        [attr.stroke]="color()"
        stroke-width="4"
        stroke-linecap="round"
        [attr.stroke-dasharray]="dash() + ' 200'"
        transform="rotate(-90 22 22)"
        class="transition-all duration-1000"
      />
      <text x="22" y="22" text-anchor="middle" dominant-baseline="central" class="fill-white font-display text-[11px] font-bold">
        {{ rounded() }}
      </text>
    </svg>
  `,
})
export class ScoreRing {
  readonly value = input.required<number>();
  readonly color = input('#a78bfa');
  readonly size = input(52);
  protected readonly rounded = computed(() => Math.round(this.value()));
  protected readonly dash = computed(() => (Math.max(0, Math.min(100, this.value())) / 100) * 2 * Math.PI * 18);
}
