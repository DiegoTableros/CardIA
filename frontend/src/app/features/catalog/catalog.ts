import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import type { CardQueryParams, CardSummary } from '../../core/api/types';
import { BENEFIT_ICON, money } from '../../core/format';
import { CardTile } from '../../shared/card-tile';
import { CompareStore, MAX_COMPARE } from '../../shared/compare-store';
import { Icon } from '../../shared/icon';
import { Disclaimer, EmptyState, ErrorState } from '../../shared/states';

type SortKey = NonNullable<CardQueryParams['sort']>;

@Component({
  selector: 'app-catalog',
  imports: [FormsModule, RouterLink, CardTile, Icon, ErrorState, EmptyState, Disclaimer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="section-eyebrow">Catálogo</p>
        <h1 class="section-title sm:text-4xl">Explora las tarjetas</h1>
        <p class="mt-2 text-slate-400">Filtra por banco, perfil o beneficio y compara hasta {{ max }} tarjetas.</p>
      </div>
      <div class="flex items-center gap-2 text-sm text-slate-400" aria-live="polite">
        <span class="font-display text-2xl font-bold text-white">{{ filtered().length }}</span> de {{ all().length }} tarjetas
      </div>
    </header>

    <!-- Filtros -->
    <section class="glass sticky top-18 z-20 mt-6 p-4" aria-label="Filtros">
      <div class="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div class="relative">
          <label for="q" class="sr-only">Buscar</label>
          <app-icon name="search" [size]="16" class="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-500" />
          <input id="q" class="input pl-10" placeholder="Buscar por nombre o banco…" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        </div>
        <div>
          <label for="inst" class="sr-only">Institución</label>
          <select id="inst" class="input" [ngModel]="institution()" (ngModelChange)="institution.set($event)">
            <option value="">Todas las instituciones</option>
            @for (i of facets.value()?.institutions ?? []; track i) {
              <option [value]="i">{{ i }}</option>
            }
          </select>
        </div>
        <div>
          <label for="cls" class="sr-only">Clase</label>
          <select id="cls" class="input" [ngModel]="cardClass()" (ngModelChange)="cardClass.set($event)">
            <option value="">Todas las clases</option>
            @for (c of facets.value()?.classes ?? []; track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
        </div>
        <div>
          <label for="sort" class="sr-only">Ordenar</label>
          <select id="sort" class="input" [ngModel]="sort()" (ngModelChange)="sort.set($event)">
            <option value="name">Orden: nombre</option>
            <option value="annual_fee">Menor anualidad</option>
            <option value="cat">Menor CAT</option>
            <option value="interest_rate">Menor tasa</option>
            <option value="benefits">Más beneficios</option>
            <option value="credit_line_min">Menor línea inicial</option>
          </select>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <span class="mr-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Perfil</span>
        @for (p of facets.value()?.profiles ?? []; track p.id) {
          <button type="button" class="chip" [class.chip-active]="profileId() === p.id" [attr.aria-pressed]="profileId() === p.id" (click)="toggleProfile(p.id)">
            <span class="h-2 w-2 rounded-full" [style.background]="p.color"></span>{{ p.label }}
          </button>
        }
        <span class="mx-1 hidden h-5 w-px bg-white/10 sm:block"></span>
        <button type="button" class="chip" [class.chip-active]="noFee()" [attr.aria-pressed]="noFee()" (click)="noFee.set(!noFee())">
          <app-icon name="gift" [size]="13" /> Sin anualidad
        </button>
        @for (b of facets.value()?.benefit_types ?? []; track b) {
          <button type="button" class="chip" [class.chip-active]="benefit() === b" [attr.aria-pressed]="benefit() === b" (click)="benefit.set(benefit() === b ? '' : b)">
            <app-icon [name]="icon(b)" [size]="13" /> {{ b }}
          </button>
        }
        @if (hasFilters()) {
          <button type="button" class="btn-ghost btn-sm ml-auto text-rose-300" (click)="reset()"><app-icon name="x" [size]="14" /> Limpiar</button>
        }
      </div>
      <div class="mt-3 flex items-center gap-3">
        <label for="fee" class="text-xs font-semibold tracking-wide whitespace-nowrap text-slate-500 uppercase">Anualidad máx.</label>
        <input id="fee" type="range" min="0" [max]="feeMax()" step="100" class="w-full accent-brand-500" [ngModel]="maxFee()" (ngModelChange)="maxFee.set(+$event)" />
        <span class="w-24 text-right text-sm font-semibold text-white tabular-nums">{{ maxFee() >= feeMax() ? 'Cualquiera' : money(maxFee()) }}</span>
      </div>
    </section>

    <!-- Resultados -->
    <section class="mt-6">
      @if (cards.error()) {
        <app-error-state (retry)="cards.reload()" />
      } @else if (cards.isLoading()) {
        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          @for (i of [1, 2, 3, 4, 5, 6, 7, 8]; track i) {
            <div class="surface space-y-3 p-4"><div class="skeleton aspect-[1.586]"></div><div class="skeleton h-4 w-2/3"></div><div class="skeleton h-12"></div></div>
          }
        </div>
      } @else if (filtered().length === 0) {
        <app-empty-state title="Ninguna tarjeta coincide" message="Quita algún filtro o amplía la anualidad máxima.">
          <button type="button" class="btn-secondary btn-sm mt-2" (click)="reset()">Limpiar filtros</button>
        </app-empty-state>
      } @else {
        <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          @for (c of filtered(); track c.id; let i = $index) {
            <app-card-tile
              class="animate-fade-up"
              [style.animation-delay]="(i % 12) * 35 + 'ms'"
              [card]="c"
              [selectable]="true"
              [selected]="compare.has(c.id)"
              (toggle)="onToggle($event)"
            />
          }
        </div>
      }
    </section>

    <app-disclaimer class="mt-10 block" />

    <!-- Barra de comparacion -->
    @if (compare.count()) {
      <div class="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-900/90 backdrop-blur-xl animate-fade-up">
        <div class="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <span class="text-sm font-semibold text-white">Comparar ({{ compare.count() }}/{{ max }})</span>
          <div class="flex flex-1 flex-wrap gap-2">
            @for (c of selectedCards(); track c.id) {
              <span class="inline-flex items-center gap-1.5 rounded-lg bg-white/8 py-1 pr-1 pl-2.5 text-xs text-slate-200">
                {{ c.name }}
                <button type="button" class="rounded p-0.5 hover:bg-white/15" (click)="compare.toggle(c.id)" [attr.aria-label]="'Quitar ' + c.name"><app-icon name="x" [size]="12" /></button>
              </span>
            }
          </div>
          <button type="button" class="btn-ghost btn-sm" (click)="compare.clear()">Vaciar</button>
          <a routerLink="/comparar" class="btn-primary btn-sm" [class.pointer-events-none]="compare.count() < 2" [class.opacity-50]="compare.count() < 2">
            <app-icon name="compare" [size]="14" /> Comparar
          </a>
        </div>
      </div>
    }
    @if (toast()) {
      <div role="status" class="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 rounded-xl border border-amber-400/30 bg-ink-900 px-4 py-2 text-sm text-amber-200 shadow-xl">
        {{ toast() }}
      </div>
    }
  `,
})
export class CatalogPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly compare = inject(CompareStore);
  protected readonly max = MAX_COMPARE;
  protected readonly money = money;

  /** Query param ?perfil=N (desde la home). */
  readonly perfil = input<string>();

  protected readonly cards = rxResource({ stream: () => this.api.allCards() });
  protected readonly facets = rxResource({ stream: () => this.api.facets() });

  protected readonly q = signal('');
  protected readonly institution = signal('');
  protected readonly cardClass = signal('');
  protected readonly benefit = signal('');
  protected readonly profileId = signal<number | null>(null);
  protected readonly noFee = signal(false);
  protected readonly sort = signal<SortKey>('name');
  protected readonly maxFee = signal(100000);
  protected readonly toast = signal('');

  protected readonly all = computed<CardSummary[]>(() => this.cards.value()?.items ?? []);
  protected readonly feeMax = computed(() => Math.ceil((this.facets.value()?.annual_fee.max ?? 7000) / 100) * 100);

  constructor() {
    effect(() => {
      const p = this.perfil();
      if (p !== undefined && p !== '') this.profileId.set(Number(p));
    });
    effect(() => this.maxFee.set(this.feeMax()));
  }

  protected readonly filtered = computed(() => {
    const needle = this.fold(this.q());
    const out = this.all().filter(
      (c) =>
        (!needle || this.fold(c.name).includes(needle) || this.fold(c.institution).includes(needle)) &&
        (!this.institution() || c.institution === this.institution()) &&
        (!this.cardClass() || c.card_class === this.cardClass()) &&
        (!this.benefit() || c.benefit_types.includes(this.benefit())) &&
        (this.profileId() === null || c.profile.id === this.profileId()) &&
        (!this.noFee() || !c.annual_fee) &&
        (c.annual_fee ?? 0) <= this.maxFee(),
    );
    const s = this.sort();
    const num = (v: number | null | undefined) => v ?? Number.POSITIVE_INFINITY;
    return out.sort((a, b) => {
      switch (s) {
        case 'annual_fee':
          return num(a.annual_fee) - num(b.annual_fee);
        case 'cat':
          return num(a.cat) - num(b.cat);
        case 'interest_rate':
          return num(a.interest_rate) - num(b.interest_rate);
        case 'credit_line_min':
          return num(a.credit_line_min) - num(b.credit_line_min);
        case 'benefits':
          return b.benefit_types.length - a.benefit_types.length;
        default:
          return a.name.localeCompare(b.name, 'es');
      }
    });
  });

  protected readonly selectedCards = computed(() => {
    const ids = this.compare.ids();
    return this.all().filter((c) => ids.includes(c.id));
  });

  protected readonly hasFilters = computed(
    () =>
      !!(this.q() || this.institution() || this.cardClass() || this.benefit() || this.noFee()) ||
      this.profileId() !== null ||
      this.maxFee() < this.feeMax(),
  );

  toggleProfile(id: number): void {
    this.profileId.set(this.profileId() === id ? null : id);
    this.router.navigate([], { queryParams: { perfil: this.profileId() ?? null }, replaceUrl: true });
  }

  onToggle(id: string): void {
    if (!this.compare.has(id) && this.compare.full()) {
      this.toast.set(`Puedes comparar hasta ${MAX_COMPARE} tarjetas.`);
      setTimeout(() => this.toast.set(''), 2500);
      return;
    }
    this.compare.toggle(id);
  }

  reset(): void {
    this.q.set('');
    this.institution.set('');
    this.cardClass.set('');
    this.benefit.set('');
    this.profileId.set(null);
    this.noFee.set(false);
    this.sort.set('name');
    this.maxFee.set(this.feeMax());
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  icon(b: string): string {
    return BENEFIT_ICON[b] ?? 'star';
  }

  private fold(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
}
