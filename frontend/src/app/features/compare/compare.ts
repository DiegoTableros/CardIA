import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import type { CompareMetric } from '../../core/api/types';
import { money, pct } from '../../core/format';
import { CardArt } from '../../shared/card-art';
import { CompareStore, MAX_COMPARE } from '../../shared/compare-store';
import { Icon } from '../../shared/icon';
import { Disclaimer, EmptyState, ErrorState } from '../../shared/states';

@Component({
  selector: 'app-compare',
  imports: [FormsModule, RouterLink, CardArt, Icon, ErrorState, EmptyState, Disclaimer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="section-eyebrow">Comparador de tarjetas</p>
        <h1 class="section-title sm:text-4xl">Explora sus diferencias</h1>
        <p class="mt-2 text-slate-400">Elige de 2 a {{ max }} tarjetas. Resaltamos el mejor valor de cada métrica.</p>
      </div>
      <div class="flex w-full gap-2 sm:w-auto">
        <label for="add" class="sr-only">Agregar tarjeta</label>
        <select id="add" class="input sm:w-72" [ngModel]="''" (ngModelChange)="add($event)" [disabled]="store.full()">
          <option value="">{{ store.full() ? 'Máximo ' + max + ' tarjetas' : '+ Agregar tarjeta…' }}</option>
          @for (c of available(); track c.id) {
            <option [value]="c.id">{{ c.name }} · {{ c.institution }}</option>
          }
        </select>
        @if (store.count()) {
          <button type="button" class="btn-ghost" (click)="store.clear()" title="Vaciar"><app-icon name="trash" [size]="16" /></button>
        }
      </div>
    </header>

    <section class="mt-8">
      @if (store.count() < 2) {
        <app-empty-state icon="compare" title="Selecciona al menos 2 tarjetas" message="Agrégalas desde el selector de arriba o con el botón «Comparar» del catálogo.">
          <a routerLink="/tarjetas" class="btn-primary btn-sm mt-2"><app-icon name="cards" [size]="14" /> Ir al catálogo</a>
        </app-empty-state>
      } @else if (result.error()) {
        <app-error-state (retry)="result.reload()" />
      } @else if (result.isLoading() && !result.value()) {
        <div class="grid gap-4 md:grid-cols-3"><div class="skeleton h-64"></div><div class="skeleton h-64"></div><div class="skeleton h-64"></div></div>
      } @else if (result.value(); as r) {
        <div class="overflow-x-auto pb-2">
          <div class="grid min-w-[640px] gap-4" [style.grid-template-columns]="'180px repeat(' + r.cards.length + ', minmax(0, 1fr))'">
            <!-- Cabeceras -->
            <div></div>
            @for (c of r.cards; track c.id) {
              <div class="surface relative p-3 animate-fade-up">
                <button type="button" class="absolute top-2 right-2 z-10 rounded-lg bg-black/40 p-1 text-white hover:bg-black/60" (click)="store.toggle(c.id)" [attr.aria-label]="'Quitar ' + c.name">
                  <app-icon name="x" [size]="14" />
                </button>
                <a [routerLink]="['/tarjetas', c.id]" class="block"><app-card-art [name]="c.name" [institution]="c.institution" [cardClass]="c.card_class" [imageUrl]="c.image_url" [orientation]="c.image_orientation" /></a>
                <p class="mt-3 truncate font-semibold text-white">{{ c.name }}</p>
                <p class="truncate text-xs text-slate-400">{{ c.institution }}</p>
                <span class="badge mt-1" [style.background]="c.profile.color + '26'" [style.color]="c.profile.color">{{ c.profile.label }}</span>
              </div>
            }

            <!-- Metricas -->
            @for (m of r.metrics; track m.key) {
              <div class="flex items-center text-sm font-medium text-slate-400">
                {{ m.label }}
                <span class="ml-1 text-[10px] text-slate-600">{{ m.better === 'lower' ? '↓ mejor' : '↑ mejor' }}</span>
              </div>
              @for (c of r.cards; track c.id) {
                <div class="rounded-xl px-3 py-3 transition" [class]="m.best_id === c.id ? 'bg-emerald-400/10 ring-1 ring-emerald-400/40' : 'bg-white/3'">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-display text-lg font-bold tabular-nums" [class]="m.best_id === c.id ? 'text-emerald-300' : 'text-white'">
                      {{ fmt(m, m.values[c.id]) }}
                    </span>
                    @if (m.best_id === c.id) {
                      <app-icon name="star" [size]="14" class="text-emerald-300" />
                    }
                  </div>
                  <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div class="h-full rounded-full" [style.width.%]="bar(m, m.values[c.id])" [style.background]="c.profile.color"></div>
                  </div>
                </div>
              }
            }

            <!-- Beneficios -->
            <div class="flex items-start pt-3 text-sm font-medium text-slate-400">Beneficios</div>
            @for (c of r.cards; track c.id) {
              <ul class="space-y-1.5 rounded-xl bg-white/3 p-3 text-xs">
                @for (b of c.benefit_types; track b) {
                  <li class="flex items-center gap-1.5 text-slate-300"><app-icon name="check" [size]="12" class="text-emerald-400" /> {{ b }}</li>
                } @empty {
                  <li class="text-slate-500">Sin beneficios reportados</li>
                }
              </ul>
            }

            <!-- Requisitos -->
            <div class="flex items-start pt-3 text-sm font-medium text-slate-400">Requisitos</div>
            @for (c of r.cards; track c.id) {
              <ul class="space-y-1 rounded-xl bg-white/3 p-3 text-xs text-slate-300">
                <li>Edad: {{ c.requirements.age_min ?? '?' }}–{{ c.requirements.age_max ?? '?' }}</li>
                <li>Score: {{ c.requirements.score_min ?? 'No publicado' }}</li>
                <li>Ingreso: {{ money(c.requirements.monthly_income_min) }}</li>
              </ul>
            }
          </div>
        </div>
        <app-disclaimer class="mt-8 block" />
      }
    </section>
  `,
})
export class ComparePage {
  private readonly api = inject(ApiService);
  protected readonly store = inject(CompareStore);
  protected readonly max = MAX_COMPARE;
  protected readonly money = money;

  private readonly all = rxResource({ stream: () => this.api.allCards() });
  protected readonly result = rxResource({
    params: () => this.store.ids(),
    stream: ({ params }) => (params.length >= 2 ? this.api.compare(params) : of(undefined)),
  });

  protected readonly available = computed(() => {
    const ids = this.store.ids();
    return (this.all.value()?.items ?? []).filter((c) => !ids.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

  add(id: string): void {
    if (id) this.store.toggle(id);
  }

  fmt(m: CompareMetric, v: number | null | undefined): string {
    if (v === null || v === undefined) return 'N/D';
    if (m.unit === 'MXN') return money(v);
    if (m.unit === '%') return pct(v);
    return String(v);
  }

  bar(m: CompareMetric, v: number | null | undefined): number {
    const vals = Object.values(m.values).filter((x): x is number => x !== null && x !== undefined);
    const max = Math.max(1, ...vals);
    return v ? Math.max(4, (v / max) * 100) : 0;
  }
}
