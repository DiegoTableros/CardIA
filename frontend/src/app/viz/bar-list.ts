import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarItem {
  label: string;
  value: number;
  color?: string;
}

@Component({
  selector: 'app-bar-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="space-y-2.5">
      @for (b of rows(); track b.label) {
        <li>
          <div class="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span class="truncate text-slate-300">{{ b.label }}</span>
            <span class="font-semibold text-white tabular-nums">{{ b.value }}{{ suffix() }}</span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              class="h-full rounded-full transition-[width] duration-700"
              [style.width.%]="b.pct"
              [style.background]="b.color ?? 'linear-gradient(90deg, var(--color-brand-500), var(--color-accent-400))'"
            ></div>
          </div>
        </li>
      }
    </ul>
  `,
})
export class BarList {
  readonly items = input.required<BarItem[]>();
  readonly suffix = input('');
  protected readonly rows = computed(() => {
    const max = Math.max(1, ...this.items().map((i) => i.value));
    return this.items().map((i) => ({ ...i, pct: (i.value / max) * 100 }));
  });
}
