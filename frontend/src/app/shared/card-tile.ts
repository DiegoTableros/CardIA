import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CardSummary } from '../core/api/types';
import { BENEFIT_ICON, money, pct } from '../core/format';
import { CardVisual } from './card-visual';
import { Icon } from './icon';

@Component({
  selector: 'app-card-tile',
  imports: [CardVisual, Icon, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @let c = card();
    <article
      class="group surface relative flex h-full flex-col gap-4 p-4 transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-(--shadow-glow)"
    >
      <a [routerLink]="['/tarjetas', c.id]" class="block rounded-2xl text-[15px] transition duration-500 group-hover:[transform:perspective(900px)_rotateX(6deg)_rotateY(-8deg)]" [attr.aria-label]="'Ver detalle de ' + c.name">
        <app-card-visual [name]="c.name" [institution]="c.institution" [cardClass]="c.card_class" />
      </a>
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <h3 class="truncate text-base font-semibold">
            <a [routerLink]="['/tarjetas', c.id]" class="hover:text-brand-300">{{ c.name }}</a>
          </h3>
          <p class="text-xs text-slate-400">{{ c.institution }} · {{ c.card_class }}</p>
        </div>
        <span class="badge shrink-0" [style.background]="c.profile.color + '26'" [style.color]="c.profile.color">
          {{ c.profile.label }}
        </span>
      </div>
      <dl class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-lg bg-white/4 px-1 py-2">
          <dt class="text-[10px] tracking-wide text-slate-500 uppercase">Anualidad</dt>
          <dd class="mt-0.5 text-sm font-semibold" [class.text-emerald-300]="!c.annual_fee" [class.text-white]="!!c.annual_fee">
            {{ c.annual_fee ? money(c.annual_fee) : 'Sin costo' }}
          </dd>
        </div>
        <div class="rounded-lg bg-white/4 px-1 py-2">
          <dt class="text-[10px] tracking-wide text-slate-500 uppercase">CAT</dt>
          <dd class="mt-0.5 text-sm font-semibold text-white">{{ pct(c.cat) }}</dd>
        </div>
        <div class="rounded-lg bg-white/4 px-1 py-2">
          <dt class="text-[10px] tracking-wide text-slate-500 uppercase">Tasa</dt>
          <dd class="mt-0.5 text-sm font-semibold text-white">{{ pct(c.interest_rate) }}</dd>
        </div>
      </dl>
      <div class="flex flex-wrap gap-1.5">
        @for (b of c.benefit_types; track b) {
          <span class="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[11px] text-slate-300" [title]="b">
            <app-icon [name]="icon(b)" [size]="12" class="text-accent-400" />{{ b }}
          </span>
        }
      </div>
      <div class="mt-auto flex items-center justify-between gap-2 pt-1">
        <a [routerLink]="['/tarjetas', c.id]" class="btn-ghost btn-sm -ml-2">Ver detalle <app-icon name="arrow" [size]="14" /></a>
        @if (selectable()) {
          <button
            type="button"
            class="btn-ghost btn-sm"
            [class.bg-brand-500/25]="selected()"
            [class.ring-1]="selected()"
            [class.ring-brand-400/60]="selected()"
            [class.!text-white]="selected()"
            [attr.aria-pressed]="selected()"
            (click)="toggle.emit(c.id)"
          >
            <app-icon [name]="selected() ? 'check' : 'compare'" [size]="14" />
            {{ selected() ? 'Comparando' : 'Comparar' }}
          </button>
        }
      </div>
    </article>
  `,
})
export class CardTile {
  readonly card = input.required<CardSummary>();
  readonly selectable = input(false);
  readonly selected = input(false);
  readonly toggle = output<string>();
  protected readonly money = money;
  protected readonly pct = pct;
  protected icon(b: string): string {
    return BENEFIT_ICON[b] ?? 'star';
  }
}
