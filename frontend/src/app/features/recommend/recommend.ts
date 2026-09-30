import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from '../../core/api/api.service';
import type { RecommendResponse, UserProfileIn } from '../../core/api/types';
import { BENEFIT_ICON, money, pct } from '../../core/format';
import { CardVisual } from '../../shared/card-visual';
import { CompareStore } from '../../shared/compare-store';
import { Icon } from '../../shared/icon';
import { Disclaimer } from '../../shared/states';
import { ScoreRing } from '../../viz/score-ring';

type Income = UserProfileIn['income_range'];
type Use = NonNullable<UserProfileIn['main_use']>;
type Score = NonNullable<UserProfileIn['credit_score']>;
type Benefit = NonNullable<UserProfileIn['benefits']>[number];

const PROFILE_ICON: Record<string, string> = { arranque: 'sprout', cotidiana: 'cart', tasa_baja: 'percent', premium: 'plane' };
const STORAGE = 'cardia.recommend.form';

@Component({
  selector: 'app-recommend',
  imports: [FormsModule, RouterLink, CardVisual, Icon, Disclaimer, ScoreRing],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="max-w-3xl">
      <p class="section-eyebrow">Para ti</p>
      <h1 class="section-title sm:text-4xl">¿Qué tarjeta va con tu perfil?</h1>
      <p class="mt-2 text-slate-400">
        Responde 4 preguntas rápidas. Solo usamos rangos y preferencias: <strong class="text-slate-200">nunca</strong> pedimos nombre, RFC, CURP ni datos
        bancarios.
      </p>
    </header>

    <div class="mt-8 grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
      <!-- FORMULARIO -->
      <form class="glass h-fit p-5 sm:p-6 lg:sticky lg:top-24" (ngSubmit)="submit()">
        <!-- Stepper -->
        <ol class="mb-6 flex items-center gap-2" aria-label="Progreso">
          @for (s of steps; track s; let i = $index) {
            <li class="flex flex-1 items-center gap-2">
              <button
                type="button"
                (click)="step.set(i)"
                class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition"
                [class]="i < step() ? 'bg-emerald-500 text-white' : i === step() ? 'bg-gradient-to-br from-brand-500 to-hot-500 text-white shadow-(--shadow-glow)' : 'bg-white/8 text-slate-400'"
                [attr.aria-current]="i === step() ? 'step' : null"
                [attr.aria-label]="'Paso ' + (i + 1) + ': ' + s"
              >
                @if (i < step()) {
                  <app-icon name="check" [size]="14" />
                } @else {
                  {{ i + 1 }}
                }
              </button>
              @if (i < steps.length - 1) {
                <span class="h-0.5 flex-1 rounded" [class]="i < step() ? 'bg-emerald-500' : 'bg-white/10'"></span>
              }
            </li>
          }
        </ol>

        @switch (step()) {
          @case (0) {
            <fieldset class="animate-fade-up space-y-5">
              <legend class="text-lg font-semibold text-white">Sobre ti</legend>
              <div>
                <label for="age" class="label">Edad: <span class="text-white">{{ age() }} años</span></label>
                <input id="age" name="age" type="range" min="18" max="80" class="w-full accent-brand-500" [ngModel]="age()" (ngModelChange)="age.set(+$event)" />
              </div>
              <div>
                <span class="label" id="income-l">Ingreso mensual aproximado</span>
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-labelledby="income-l">
                  @for (o of incomes; track o.v) {
                    <button type="button" role="radio" class="chip justify-center py-2.5" [class.chip-active]="income() === o.v" [attr.aria-checked]="income() === o.v" (click)="income.set(o.v)">
                      {{ o.l }}
                    </button>
                  }
                </div>
              </div>
            </fieldset>
          }
          @case (1) {
            <fieldset class="animate-fade-up space-y-5">
              <legend class="text-lg font-semibold text-white">Tu historial</legend>
              <div>
                <span class="label" id="score-l">¿Conoces tu score de crédito?</span>
                <div class="grid gap-2" role="radiogroup" aria-labelledby="score-l">
                  @for (o of scores; track o.v) {
                    <button type="button" role="radio" class="chip justify-between py-2.5" [class.chip-active]="score() === o.v" [attr.aria-checked]="score() === o.v" (click)="score.set(o.v)">
                      <span>{{ o.l }}</span><span class="text-slate-500">{{ o.h }}</span>
                    </button>
                  }
                </div>
              </div>
              <div>
                <label for="seniority" class="label">Antigüedad en tu empleo actual</label>
                <select id="seniority" name="seniority" class="input" [ngModel]="seniority()" (ngModelChange)="seniority.set($event)">
                  <option [ngValue]="null">Prefiero no decir</option>
                  <option [ngValue]="3">Menos de 6 meses</option>
                  <option [ngValue]="9">6 a 12 meses</option>
                  <option [ngValue]="24">1 a 3 años</option>
                  <option [ngValue]="48">Más de 3 años</option>
                </select>
              </div>
            </fieldset>
          }
          @case (2) {
            <fieldset class="animate-fade-up space-y-5">
              <legend class="text-lg font-semibold text-white">Cómo la usarías</legend>
              <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Uso principal">
                @for (o of uses; track o.v) {
                  <button
                    type="button"
                    role="radio"
                    class="flex flex-col items-start gap-2 rounded-xl border p-3 text-left text-sm transition"
                    [class]="use() === o.v ? 'border-brand-400/60 bg-brand-500/15 text-white' : 'border-white/8 bg-white/3 text-slate-300 hover:border-white/20'"
                    [attr.aria-checked]="use() === o.v"
                    (click)="use.set(o.v)"
                  >
                    <app-icon [name]="o.i" [size]="20" [class]="use() === o.v ? 'text-brand-300' : 'text-slate-500'" />
                    <span class="font-medium">{{ o.l }}</span>
                  </button>
                }
              </div>
            </fieldset>
          }
          @case (3) {
            <fieldset class="animate-fade-up space-y-5">
              <legend class="text-lg font-semibold text-white">Tus preferencias</legend>
              <label class="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/3 p-3.5">
                <span>
                  <span class="block text-sm font-medium text-white">¿Pagas el total cada mes?</span>
                  <span class="block text-xs text-slate-400">Ser «totalero» evita pagar intereses</span>
                </span>
                <input type="checkbox" name="full" class="peer sr-only" [ngModel]="paysInFull()" (ngModelChange)="paysInFull.set($event)" />
                <span class="relative h-6 w-11 shrink-0 rounded-full bg-white/15 transition peer-checked:bg-emerald-500 peer-focus-visible:outline-2 peer-focus-visible:outline-accent-400 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"></span>
              </label>
              <label class="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/3 p-3.5">
                <span>
                  <span class="block text-sm font-medium text-white">Prefiero no pagar anualidad</span>
                  <span class="block text-xs text-slate-400">Priorizamos tarjetas de $0 o anualidad baja</span>
                </span>
                <input type="checkbox" name="nofee" class="peer sr-only" [ngModel]="avoidFee()" (ngModelChange)="avoidFee.set($event)" />
                <span class="relative h-6 w-11 shrink-0 rounded-full bg-white/15 transition peer-checked:bg-emerald-500 peer-focus-visible:outline-2 peer-focus-visible:outline-accent-400 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"></span>
              </label>
              <div>
                <span class="label">Beneficios que te interesan</span>
                <div class="flex flex-wrap gap-2">
                  @for (b of benefitOptions; track b) {
                    <button type="button" class="chip" [class.chip-active]="benefits().includes(b)" [attr.aria-pressed]="benefits().includes(b)" (click)="toggleBenefit(b)">
                      <app-icon [name]="icon(b)" [size]="13" /> {{ b }}
                    </button>
                  }
                </div>
              </div>
            </fieldset>
          }
        }

        <div class="mt-7 flex items-center justify-between gap-3">
          <button type="button" class="btn-ghost" (click)="step.set(step() - 1)" [disabled]="step() === 0"><app-icon name="back" [size]="16" /> Atrás</button>
          @if (step() < steps.length - 1) {
            <button type="button" class="btn-primary" (click)="step.set(step() + 1)">Siguiente <app-icon name="arrow" [size]="16" /></button>
          } @else {
            <button type="submit" class="btn-primary" [disabled]="loading()">
              @if (loading()) {
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span> Analizando…
              } @else {
                <app-icon name="sparkles" [size]="16" /> Ver recomendaciones
              }
            </button>
          }
        </div>
      </form>

      <!-- RESULTADOS -->
      <section aria-live="polite">
        @if (error()) {
          <div role="alert" class="surface p-6 text-center">
            <p class="font-semibold text-white">No pudimos calcular tus recomendaciones</p>
            <p class="mt-1 text-sm text-slate-400">{{ error() }}</p>
            <button type="button" class="btn-secondary btn-sm mt-4" (click)="submit()">Reintentar</button>
          </div>
        } @else if (loading()) {
          <div class="space-y-4">
            <div class="skeleton h-44"></div>
            <div class="skeleton h-32"></div>
            <div class="skeleton h-32"></div>
          </div>
        } @else if (result(); as r) {
          <!-- Perfil -->
          <div class="relative overflow-hidden rounded-3xl border border-white/10 p-6 animate-fade-up" [style.background]="'linear-gradient(135deg,' + r.profile.color + '33, transparent 70%)'">
            <div class="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full opacity-40 blur-3xl" [style.background]="r.profile.color"></div>
            <div class="relative flex flex-wrap items-start gap-4">
              <span class="grid h-14 w-14 place-items-center rounded-2xl" [style.background]="r.profile.color + '33'" [style.color]="r.profile.color">
                <app-icon [name]="profileIcon(r.profile.key)" [size]="28" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-xs font-bold tracking-[0.2em] uppercase" [style.color]="r.profile.color">Tu perfil</p>
                <h2 class="mt-1 text-3xl font-bold">{{ r.profile.label }}</h2>
                <p class="mt-1 text-slate-300">{{ r.profile.tagline }}</p>
              </div>
              @if (r.model.is_stub) {
                <span class="badge bg-amber-400/15 text-amber-300" title="{{ r.model.description }}">Modelo preliminar {{ r.model.version }}</span>
              }
            </div>
            <p class="relative mt-4 text-sm text-slate-300">{{ r.profile_reason }}</p>
            <p class="relative mt-2 text-sm text-slate-400">{{ r.profile.description }}</p>
            <div class="relative mt-4 flex flex-wrap gap-2">
              @for (t of r.profile.traits; track t) {
                <span class="rounded-lg bg-black/25 px-2.5 py-1 text-xs text-slate-200">{{ t }}</span>
              }
            </div>
          </div>

          <!-- Top -->
          <div class="mt-8 flex items-end justify-between gap-3">
            <h2 class="text-xl font-semibold">Top {{ r.recommendations.length }} para ti</h2>
            <p class="text-xs text-slate-500">{{ r.excluded_count }} tarjetas no cumplen tus datos básicos</p>
          </div>
          @if (r.recommendations.length === 0) {
            <div class="surface mt-4 p-6 text-center text-sm text-slate-400">Ninguna tarjeta de la base cumple los requisitos con los datos indicados. Prueba ajustar tu rango de ingreso.</div>
          }
          <ol class="mt-4 space-y-4">
            @for (rec of r.recommendations; track rec.card.id; let i = $index) {
              <li class="surface grid gap-4 p-4 animate-fade-up sm:grid-cols-[180px_1fr_auto] sm:items-center" [style.animation-delay]="i * 70 + 'ms'">
                <a [routerLink]="['/tarjetas', rec.card.id]" class="relative block text-[12px]">
                  <span class="absolute -top-2 -left-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-hot-500 text-xs font-bold text-white shadow-lg">{{ i + 1 }}</span>
                  <app-card-visual [name]="rec.card.name" [institution]="rec.card.institution" [cardClass]="rec.card.card_class" />
                </a>
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <a [routerLink]="['/tarjetas', rec.card.id]" class="font-semibold text-white hover:text-brand-300">{{ rec.card.name }}</a>
                    <span class="badge" [class]="eligClass(rec.eligibility)">{{ eligLabel(rec.eligibility) }}</span>
                  </div>
                  <p class="text-xs text-slate-400">{{ rec.card.institution }} · {{ rec.card.card_class }} · Perfil {{ rec.card.profile.label }}</p>
                  <p class="mt-2 text-xs text-slate-300">
                    Anualidad <strong class="text-white">{{ rec.card.annual_fee ? money(rec.card.annual_fee) : '$0' }}</strong> · CAT
                    <strong class="text-white">{{ pct(rec.card.cat) }}</strong> · Tasa <strong class="text-white">{{ pct(rec.card.interest_rate) }}</strong>
                  </p>
                  <ul class="mt-2 space-y-1 text-xs">
                    @for (why of rec.reasons; track why) {
                      <li class="flex gap-1.5 text-emerald-300/90"><app-icon name="check" [size]="13" class="mt-px" /> {{ why }}</li>
                    }
                    @for (w of rec.warnings; track w) {
                      <li class="flex gap-1.5 text-amber-300/90"><app-icon name="alert" [size]="13" class="mt-px" /> {{ w }}</li>
                    }
                  </ul>
                </div>
                <div class="flex items-center gap-3 sm:flex-col">
                  <app-score-ring [value]="rec.score" [color]="r.profile.color" />
                  <span class="text-[10px] tracking-wide text-slate-500 uppercase">Afinidad</span>
                  <button type="button" class="btn-ghost btn-sm" (click)="compare.toggle(rec.card.id)" [attr.aria-pressed]="compare.has(rec.card.id)">
                    <app-icon [name]="compare.has(rec.card.id) ? 'check' : 'compare'" [size]="14" />
                  </button>
                </div>
              </li>
            }
          </ol>

          <!-- Supuestos -->
          <details class="surface mt-6 p-5" open>
            <summary class="cursor-pointer font-semibold text-white">Supuestos de esta recomendación</summary>
            <ul class="mt-3 space-y-1.5 text-sm text-slate-400">
              @for (a of r.assumptions; track a) {
                <li class="flex gap-2"><app-icon name="info" [size]="14" class="mt-0.5 text-accent-400" /> {{ a }}</li>
              }
            </ul>
          </details>
          <div class="mt-6 flex flex-wrap gap-3">
            <a routerLink="/comparar" class="btn-secondary btn-sm"><app-icon name="compare" [size]="14" /> Comparar seleccionadas ({{ compare.count() }})</a>
            <button type="button" class="btn-secondary btn-sm" (click)="askProfile(r.profile.label)"><app-icon name="chat" [size]="14" /> Preguntar sobre mi perfil</button>
          </div>
          <app-disclaimer class="mt-6 block" [text]="r.disclaimer" />
        } @else {
          <div class="surface flex h-full min-h-80 flex-col items-center justify-center gap-4 border-dashed p-8 text-center">
            <div class="relative h-36 w-56">
              <div class="animate-float-slow absolute top-0 left-0 w-40 text-[10px] [--r:-10deg]"><app-card-visual name="?" institution="CardIA" cardClass="Oro" /></div>
              <div class="animate-float absolute right-0 bottom-0 w-40 text-[10px] [--r:8deg]"><app-card-visual name="Tu tarjeta" institution="CardIA" cardClass="Platino" /></div>
            </div>
            <p class="text-lg font-semibold text-white">Tus recomendaciones aparecerán aquí</p>
            <p class="max-w-sm text-sm text-slate-400">Completa los pasos y te diremos tu perfil y las tarjetas con mayor afinidad, con todos los supuestos a la vista.</p>
          </div>
        }
      </section>
    </div>
  `,
})
export class RecommendPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly compare = inject(CompareStore);
  protected readonly money = money;
  protected readonly pct = pct;

  protected readonly steps = ['Sobre ti', 'Historial', 'Uso', 'Preferencias'];
  protected readonly step = signal(0);

  protected readonly incomes: { v: Income; l: string }[] = [
    { v: 'lt_7k', l: 'Menos de $7,000' },
    { v: '7k_15k', l: '$7,000 – $15,000' },
    { v: '15k_30k', l: '$15,000 – $30,000' },
    { v: '30k_60k', l: '$30,000 – $60,000' },
    { v: 'gt_60k', l: 'Más de $60,000' },
  ];
  protected readonly scores: { v: Score; l: string; h: string }[] = [
    { v: 'unknown', l: 'No lo sé', h: '' },
    { v: 'none', l: 'No tengo historial', h: 'Primera tarjeta' },
    { v: 'low', l: 'Bajo', h: 'menos de 600' },
    { v: 'medium', l: 'Medio', h: '600 – 690' },
    { v: 'high', l: 'Alto', h: 'más de 690' },
  ];
  protected readonly uses: { v: Use; l: string; i: string }[] = [
    { v: 'diario', l: 'Día a día', i: 'cart' },
    { v: 'compras_meses', l: 'Compras a meses', i: 'calendar' },
    { v: 'viajes', l: 'Viajes', i: 'plane' },
    { v: 'historial', l: 'Construir historial', i: 'sprout' },
    { v: 'transferir_saldo', l: 'Pasar una deuda', i: 'swap' },
    { v: 'emergencias', l: 'Emergencias', i: 'shield' },
  ];
  protected readonly benefitOptions: Benefit[] = ['Meses sin intereses', 'Puntos', 'Descuentos', 'Preventas', 'Transferencia de Saldo', 'Seguros'];

  private readonly saved = this.read();
  protected readonly age = signal(this.saved.age ?? 28);
  protected readonly income = signal<Income>(this.saved.income_range ?? '7k_15k');
  protected readonly score = signal<Score>(this.saved.credit_score ?? 'unknown');
  protected readonly seniority = signal<number | null>(this.saved.work_seniority_months ?? null);
  protected readonly use = signal<Use>(this.saved.main_use ?? 'diario');
  protected readonly paysInFull = signal(this.saved.pays_in_full ?? true);
  protected readonly avoidFee = signal(this.saved.avoid_annual_fee ?? false);
  protected readonly benefits = signal<Benefit[]>(this.saved.benefits ?? []);

  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal<RecommendResponse | null>(null);

  private readonly payload = computed<UserProfileIn>(() => ({
    age: this.age(),
    income_range: this.income(),
    credit_score: this.score(),
    work_seniority_months: this.seniority(),
    main_use: this.use(),
    pays_in_full: this.paysInFull(),
    avoid_annual_fee: this.avoidFee(),
    benefits: this.benefits(),
  }));

  toggleBenefit(b: Benefit): void {
    const cur = this.benefits();
    this.benefits.set(cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]);
  }

  submit(): void {
    const body = this.payload();
    localStorage.setItem(STORAGE, JSON.stringify(body));
    this.loading.set(true);
    this.error.set('');
    this.api.recommend(body).subscribe({
      next: (r) => {
        this.result.set(r);
        this.loading.set(false);
        if (window.innerWidth < 1024) setTimeout(() => document.querySelector('[aria-live=polite]')?.scrollIntoView({ behavior: 'smooth' }), 50);
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(e.status === 422 ? 'Revisa los datos del formulario.' : 'El servidor no respondió. Intenta de nuevo.');
      },
    });
  }

  eligLabel(e: string): string {
    return e === 'cumple' ? 'Cumples requisitos' : 'Por confirmar';
  }

  eligClass(e: string): string {
    return e === 'cumple' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300';
  }

  icon(b: string): string {
    return BENEFIT_ICON[b] ?? 'star';
  }

  profileIcon(key: string): string {
    return PROFILE_ICON[key] ?? 'layers';
  }

  askProfile(label: string): void {
    this.router.navigate(['/asistente'], { queryParams: { q: `¿Qué significa el perfil ${label} y qué tarjetas lo forman?` } });
  }

  private read(): Partial<UserProfileIn> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE) ?? '{}');
    } catch {
      return {};
    }
  }
}
