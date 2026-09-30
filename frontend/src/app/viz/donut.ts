import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface Slice {
  label: string;
  value: number;
  color: string;
}

@Component({
  selector: 'app-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center gap-5 sm:flex-row">
      <svg viewBox="0 0 120 120" class="h-40 w-40 shrink-0 -rotate-90" role="img" [attr.aria-label]="ariaLabel()">
        <circle cx="60" cy="60" r="46" fill="none" stroke="rgb(255 255 255 / .05)" stroke-width="16" />
        @for (s of arcs(); track s.label) {
          <circle
            cx="60"
            cy="60"
            r="46"
            fill="none"
            [attr.stroke]="s.color"
            stroke-width="16"
            [attr.stroke-dasharray]="s.dash + ' ' + (circ - s.dash)"
            [attr.stroke-dashoffset]="-s.offset"
            class="transition-all duration-700"
          >
            <title>{{ s.label }}: {{ s.value }}</title>
          </circle>
        }
        <text x="60" y="60" text-anchor="middle" dominant-baseline="central" class="rotate-90 fill-white font-display text-[22px] font-bold" transform="rotate(90 60 60)">
          {{ total() }}
        </text>
      </svg>
      <ul class="w-full space-y-1.5 text-sm">
        @for (s of arcs(); track s.label) {
          <li class="flex items-center justify-between gap-3">
            <span class="flex min-w-0 items-center gap-2">
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" [style.background]="s.color"></span>
              <span class="truncate text-slate-300">{{ s.label }}</span>
            </span>
            <span class="font-semibold text-white tabular-nums">{{ s.value }} <span class="text-xs font-normal text-slate-500">({{ s.pct }}%)</span></span>
          </li>
        }
      </ul>
    </div>
  `,
})
export class Donut {
  readonly slices = input.required<Slice[]>();
  readonly ariaLabel = input('Gráfica de dona');
  protected readonly circ = 2 * Math.PI * 46;
  protected readonly total = computed(() => this.slices().reduce((a, s) => a + s.value, 0));
  protected readonly arcs = computed(() => {
    const total = this.total() || 1;
    let acc = 0;
    return this.slices().map((s) => {
      const dash = (s.value / total) * this.circ;
      const arc = { ...s, dash, offset: acc, pct: Math.round((s.value / total) * 100) };
      acc += dash;
      return arc;
    });
  });
}
