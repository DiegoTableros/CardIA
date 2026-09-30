import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { cardTheme } from '../core/format';

/** "Plastico" de tarjeta: representacion visual generica (no usa logos de bancos). */
@Component({
  selector: 'app-card-visual',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div
      class="relative aspect-[1.586] w-full overflow-hidden rounded-2xl bg-gradient-to-br p-[7%] shadow-(--shadow-lift) ring-1 ring-white/20"
      [class]="theme().bg"
    >
      <div class="pointer-events-none absolute -top-1/2 -right-1/4 h-[140%] w-[80%] rotate-12 bg-white/15 blur-2xl"></div>
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_120%,rgba(0,0,0,.35),transparent_55%)]"></div>
      <div class="relative flex h-full flex-col justify-between">
        <div class="flex items-start justify-between gap-2">
          <span class="truncate font-display text-[0.7em] font-bold tracking-widest uppercase opacity-90" [class]="theme().label">
            {{ institution() }}
          </span>
          <span class="font-display text-[0.65em] font-semibold tracking-wider uppercase opacity-80" [class]="theme().label">
            {{ cardClass() }}
          </span>
        </div>
        <div class="flex items-center gap-3">
          <div class="h-[1.9em] w-[2.6em] rounded-md bg-gradient-to-br shadow-inner" [class]="theme().chip">
            <div class="grid h-full grid-cols-3 gap-px p-[3px] opacity-50">
              @for (i of cells; track i) {
                <span class="rounded-[1px] border border-black/30"></span>
              }
            </div>
          </div>
          <svg viewBox="0 0 24 24" class="h-[1.3em] w-[1.3em] opacity-70" [class]="theme().label" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8.5 8.5a5 5 0 0 1 0 7M12 6a8.5 8.5 0 0 1 0 12M15.5 3.5a12 12 0 0 1 0 17" />
          </svg>
        </div>
        <div class="flex items-end justify-between gap-2">
          <span class="line-clamp-2 font-display text-[0.95em] leading-tight font-bold drop-shadow-sm" [class]="theme().label">
            {{ name() }}
          </span>
          <span class="flex shrink-0 -space-x-2">
            <span class="h-[1.4em] w-[1.4em] rounded-full bg-white/50 mix-blend-overlay"></span>
            <span class="h-[1.4em] w-[1.4em] rounded-full bg-black/25"></span>
          </span>
        </div>
      </div>
    </div>
  `,
})
export class CardVisual {
  readonly name = input.required<string>();
  readonly institution = input('');
  readonly cardClass = input('Clásica');
  protected readonly theme = computed(() => cardTheme(this.cardClass()));
  protected readonly cells = [0, 1, 2, 3, 4, 5];
}
