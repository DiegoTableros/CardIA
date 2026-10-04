import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import type { CardSummary, ProfileTag } from '../../core/api/types';
import { CardArt } from '../../shared/card-art';
import { CardTile } from '../../shared/card-tile';
import { CompareStore } from '../../shared/compare-store';
import { Icon } from '../../shared/icon';
import { Disclaimer, ErrorState } from '../../shared/states';

type Tab = 'lowrate' | 'nofee' | 'fewfees';

const PROFILE_ICON: Record<string, string> = { arranque: 'sprout', cotidiana: 'cart', tasa_baja: 'percent', premium: 'plane' };
const PROFILE_TAGLINE: Record<string, string> = {
  arranque: 'Tu primera tarjeta, sin complicaciones',
  cotidiana: 'Para el día a día con beneficios',
  tasa_baja: 'Si a veces financias tus compras',
  premium: 'Recompensas, viajes y seguros',
};

/** Banco de preguntas que rotan en la invitacion al asistente. */
const QUESTION_POOL = [
  '¿Cómo funciona una tarjeta de crédito?',
  '¿Qué es el pago para no generar intereses?',
  '¿Qué tarjetas no cobran anualidad?',
  '¿Qué es el pago mínimo y cómo se calcula?',
  '¿Qué es el CAT y para qué sirve?',
  '¿Qué diferencia hay entre fecha de corte y fecha límite de pago?',
  '¿Conviene sacar efectivo con la tarjeta de crédito?',
  '¿Qué comisiones cobra Black Unlimited?',
  '¿Cómo funcionan los meses sin intereses?',
  '¿Cómo construyo un buen historial crediticio?',
  '¿Qué cubre un seguro por robo o extravío?',
  '¿Qué es una transferencia de saldo?',
];

@Component({
  selector: 'app-home',
  imports: [RouterLink, CardTile, CardArt, Icon, ErrorState, Disclaimer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- HERO -->
    <section class="relative grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
      <div class="animate-fade-up">
        <span class="section-eyebrow">Hola, {{ auth.firstName() }} 👋</span>
        <h1 class="mt-3 text-4xl leading-[1.05] font-bold sm:text-5xl lg:text-6xl">
          Conoce todo sobre tarjetas de crédito, <span class="gradient-text">¿cuál es la mejor para ti?</span>
        </h1>
        <p class="mt-5 max-w-xl text-base text-slate-400 sm:text-lg">
          Explora beneficios, entiende sus comisiones y descubre qué perfil va contigo. Datos oficiales, lenguaje claro y cero letras chiquitas.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a routerLink="/encuentra-tu-tarjeta" class="btn-primary px-5 py-3 text-base"><app-icon name="sparkles" /> Encuentra tu tarjeta</a>
          <a routerLink="/tarjetas" class="btn-secondary px-5 py-3 text-base"><app-icon name="cards" /> Ver catálogo</a>
        </div>
      </div>

      <!-- Pila de tarjetas animada -->
      <div class="relative mx-auto h-[20rem] w-full max-w-md sm:h-[24rem]" aria-hidden="true">
        <div class="absolute inset-10 rounded-full bg-brand-600/30 blur-3xl"></div>
        @for (c of heroCards(); track c.id; let i = $index) {
          <div class="absolute w-[68%] transition duration-500 hover:z-20 hover:scale-105" [class]="heroPos[i]" [style.animation-delay]="-i * 1.7 + 's'">
            <app-card-art [name]="c.name" [institution]="c.institution" [cardClass]="c.card_class" [imageUrl]="c.image_url" [orientation]="c.image_orientation" [padded]="false" />
          </div>
        }
      </div>
    </section>

    <!-- DESTACADAS -->
    <section class="mt-16 sm:mt-20">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="section-eyebrow">El mercado</p>
          <h2 class="section-title">Tarjetas destacadas</h2>
        </div>
        <div class="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar destacadas">
          @for (t of tabs; track t.key) {
            <button type="button" role="tab" class="chip" [class.chip-active]="tab() === t.key" [attr.aria-selected]="tab() === t.key" (click)="tab.set(t.key)">
              <app-icon [name]="t.icon" [size]="13" /> {{ t.label }}
            </button>
          }
        </div>
      </div>

      @if (cards.error()) {
        <app-error-state class="mt-6 block" (retry)="cards.reload()" />
      } @else if (cards.isLoading()) {
        <div class="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="surface space-y-3 p-4"><div class="skeleton aspect-[1.586]"></div><div class="skeleton h-4 w-2/3"></div><div class="skeleton h-12"></div></div>
          }
        </div>
      } @else {
        <div class="-mx-4 mt-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          @for (c of featured(); track c.id; let i = $index) {
            <app-card-tile
              class="w-[82%] shrink-0 snap-center animate-fade-up sm:w-auto"
              [style.animation-delay]="i * 60 + 'ms'"
              [card]="c"
              [selectable]="true"
              [selected]="compare.has(c.id)"
              (toggle)="compare.toggle($event)"
            />
          }
        </div>
        <div class="mt-4 text-center">
          <a routerLink="/tarjetas" class="btn-ghost">Explorar todas las tarjetas <app-icon name="arrow" [size]="16" /></a>
        </div>
      }
    </section>

    <!-- ASISTENTE -->
    <section class="mt-16 sm:mt-20">
      <div class="gradient-border relative overflow-hidden rounded-3xl p-6 sm:p-10">
        <div class="pointer-events-none absolute -top-20 -right-20 h-72 w-72 rounded-full bg-hot-500/25 blur-3xl"></div>
        <div class="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl"></div>
        <div class="relative grid items-center gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <span class="badge bg-accent-400/15 text-accent-400"><app-icon name="bolt" [size]="12" /> Asistente con IA</span>
            <h2 class="mt-4 text-3xl font-bold sm:text-4xl">¿Dudas con tu tarjeta? <span class="gradient-text">Pregúntale a CardIA.</span></h2>
            <p class="mt-3 text-slate-400">
              Te explica con ejemplos cómo funciona una tarjeta de crédito, qué es el pago mínimo, cuánto cobra cada banco y mucho más.
            </p>
            <a routerLink="/asistente" class="btn-primary mt-6 px-5 py-3"><app-icon name="chat" /> Abrir asistente</a>
          </div>
          <ul class="grid gap-2.5" aria-live="polite">
            @for (q of questions(); track q) {
              <li class="animate-fade-up" [style.animation-delay]="$index * 70 + 'ms'">
                <button
                  type="button"
                  (click)="ask(q)"
                  class="group flex w-full items-center justify-between gap-3 rounded-xl border border-white/8 bg-ink-950/50 px-4 py-3 text-left text-sm text-slate-300 transition hover:border-brand-400/50 hover:bg-brand-500/10 hover:text-white"
                >
                  <span class="flex items-center gap-3"><app-icon name="chat" [size]="16" class="text-brand-400" /> {{ q }}</span>
                  <app-icon name="arrow" [size]="16" class="opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
                </button>
              </li>
            }
          </ul>
        </div>
      </div>
    </section>

    <!-- PERFILES -->
    <section class="mt-16 sm:mt-20">
      <p class="section-eyebrow">Perfiles</p>
      <h2 class="section-title">¿Qué tarjetas van contigo?</h2>
      <p class="mt-2 max-w-2xl text-slate-400">
        Agrupamos las tarjetas por costos, tasas, requisitos y beneficios. Cada perfil te ayuda a saber qué tipo de tarjeta va con tu forma de usar el
        crédito.
      </p>
      <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (p of profiles(); track p.id) {
          <a [routerLink]="['/tarjetas']" [queryParams]="{ perfil: p.id }" class="group surface relative overflow-hidden p-5 transition hover:-translate-y-1 hover:border-white/20">
            <div class="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-30 blur-2xl transition group-hover:opacity-60" [style.background]="p.color"></div>
            <span class="grid h-11 w-11 place-items-center rounded-xl" [style.background]="p.color + '26'" [style.color]="p.color">
              <app-icon [name]="p.icon || 'layers'" [size]="22" />
            </span>
            <h3 class="mt-4 text-lg font-semibold">{{ p.label }}</h3>
            <p class="mt-1 text-sm text-slate-400">{{ p.tagline }}</p>
            <p class="mt-3 flex items-center gap-1 text-sm font-medium" [style.color]="p.color">Ver tarjetas <app-icon name="arrow" [size]="14" /></p>
          </a>
        }
      </div>
    </section>

    <app-disclaimer class="mt-12 block" />
  `,
})
export class HomePage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly compare = inject(CompareStore);

  protected readonly cards = rxResource({ stream: () => this.api.allCards() });
  protected readonly tab = signal<Tab>('lowrate');
  protected readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'lowrate', label: 'Tasa baja', icon: 'percent' },
    { key: 'nofee', label: 'Sin anualidad', icon: 'gift' },
    { key: 'fewfees', label: 'Menos comisiones', icon: 'wallet' },
  ];

  protected readonly heroPos = [
    'animate-float-slow top-0 left-0 [--r:-14deg] z-0',
    'animate-float top-12 right-0 [--r:9deg] z-10',
    'animate-float-slow bottom-2 left-[15%] [--r:-3deg] z-10',
  ];

  private readonly offset = signal(0);
  protected readonly questions = computed(() => {
    const o = this.offset();
    return [0, 1, 2, 3].map((i) => QUESTION_POOL[(o + i) % QUESTION_POOL.length]);
  });

  private readonly items = computed<CardSummary[]>(() => this.cards.value()?.items ?? []);

  protected readonly heroCards = computed(() => {
    const landscape = this.items().filter((c) => c.image_url && c.image_orientation === 'landscape');
    const pick = (cls: string) => landscape.find((c) => c.card_class === cls);
    return [pick('Platino'), pick('Oro'), pick('Clásica')].filter((c): c is CardSummary => !!c);
  });

  protected readonly featured = computed(() => {
    const items = [...this.items()];
    const totalFees = (c: CardSummary) => (c.fee_counts.obligatoria ?? 0) + (c.fee_counts.por_evento ?? 0) + (c.fee_counts.penalizacion ?? 0);
    switch (this.tab()) {
      case 'nofee':
        return items.filter((c) => !c.annual_fee).sort((a, b) => b.benefit_types.length - a.benefit_types.length).slice(0, 4);
      case 'fewfees':
        return items.sort((a, b) => totalFees(a) - totalFees(b) || (a.annual_fee ?? 0) - (b.annual_fee ?? 0)).slice(0, 4);
      default:
        return items.sort((a, b) => (a.interest_rate ?? 999) - (b.interest_rate ?? 999)).slice(0, 4);
    }
  });

  protected readonly profiles = computed(() => {
    const map = new Map<number, ProfileTag>();
    for (const c of this.items()) map.set(c.profile.id, c.profile);
    return [...map.values()].sort((a, b) => a.id - b.id);
  });

  constructor() {
    const timer = setInterval(() => this.offset.update((o) => (o + 4) % QUESTION_POOL.length), 7000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  profileIcon(key: string): string {
    return PROFILE_ICON[key] ?? 'layers';
  }

  tagline(key: string): string {
    return PROFILE_TAGLINE[key] ?? '';
  }

  ask(q: string): void {
    this.router.navigate(['/asistente'], { queryParams: { q } });
  }
}
