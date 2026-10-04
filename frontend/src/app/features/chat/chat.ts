import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, effect, inject, input, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import type { CardSummary } from '../../core/api/types';
import { money, pct } from '../../core/format';
import { renderMarkdown } from '../../core/markdown';
import { CardArt } from '../../shared/card-art';
import { Icon } from '../../shared/icon';
import { Logo } from '../../shared/logo';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  html?: string;
  agents?: string[];
  cards?: CardSummary[];
  suggestions?: string[];
  status?: 'thinking' | 'done' | 'error';
}

const SESSION_KEY = 'cardia.chat.session';
const HISTORY_KEY = 'cardia.chat.history';

/** Color por agente: solo se muestran puntitos mientras responden (sin exponer el plan). */
const AGENT_COLOR: Record<string, string> = {
  FundamentalsAgent: '#a78bfa',
  ComisionesAgent: '#f472b6',
  EducativeAgent: '#22d3ee',
  PerfilAgent: '#f59e0b',
};

const QUESTION_TYPES = [
  { icon: 'cards', color: '#a78bfa', title: 'Sobre tarjetas', desc: 'Características, requisitos y comparativas.', q: 'Compara Black Unlimited y Santander Free' },
  { icon: 'wallet', color: '#f472b6', title: 'Sobre comisiones', desc: 'Qué cobra cada tarjeta y cómo te afecta.', q: '¿Qué comisiones cobra Santander Free?' },
  { icon: 'book', color: '#22d3ee', title: 'Educación financiera', desc: 'Conceptos explicados con ejemplos.', q: '¿Cómo funciona una tarjeta de crédito?' },
  { icon: 'brain', color: '#f59e0b', title: 'Perfiles', desc: 'Interpreta tus resultados de perfilamiento.', q: '¿Qué significan los perfiles de tarjeta y cuál va conmigo?' },
];

@Component({
  selector: 'app-chat',
  imports: [FormsModule, RouterLink, Icon, Logo, CardArt],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-6 lg:grid-cols-[1fr_320px]">
      <!-- Conversacion -->
      <section class="glass flex h-[calc(100dvh-10rem)] min-h-[520px] flex-col overflow-hidden">
        <header class="flex items-center justify-between gap-3 border-b border-white/6 px-4 py-3 sm:px-5">
          <div class="flex items-center gap-3">
            <app-logo [size]="34" [showText]="false" />
            <div>
              <h1 class="text-base font-semibold">Asistente CardIA</h1>
              <p class="flex items-center gap-1.5 text-xs text-slate-400">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span> En línea · datos oficiales de Banxico y CONDUSEF
              </p>
            </div>
          </div>
          <button type="button" class="btn-ghost btn-sm" (click)="newChat()" [disabled]="busy()"><app-icon name="plus" [size]="14" /> Nueva</button>
        </header>

        <div #scroller class="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6" aria-live="polite">
          @if (messages().length === 0) {
            <div class="mx-auto max-w-xl py-6 text-center animate-fade-up">
              <div class="mx-auto mb-4 w-fit"><app-logo [size]="56" [showText]="false" /></div>
              <h2 class="text-2xl font-bold">¿En qué te ayudo hoy?</h2>
              <p class="mt-2 text-sm text-slate-400">
                Pregúntame cómo funciona una tarjeta, qué cobra un banco o qué significa algún concepto. No necesito ningún dato personal para
                ayudarte.
              </p>
              <div class="mt-6 grid gap-2 text-left sm:grid-cols-2">
                @for (s of starters; track s.q) {
                  <button type="button" class="surface flex items-start gap-3 p-3 text-sm text-slate-300 transition hover:border-brand-400/40 hover:text-white" (click)="send(s.q)">
                    <app-icon [name]="s.icon" [size]="18" class="mt-0.5 text-brand-400" /> {{ s.q }}
                  </button>
                }
              </div>
            </div>
          }

          @for (m of messages(); track m.id) {
            @if (m.role === 'user') {
              <div class="flex justify-end animate-fade-up">
                <p class="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-600 to-hot-500 px-4 py-2.5 text-[15px] text-white shadow-lg">{{ m.text }}</p>
              </div>
            } @else {
              <div class="flex gap-3 animate-fade-up">
                <app-logo [size]="30" [showText]="false" class="mt-1 hidden sm:inline-flex" />
                <div class="min-w-0 flex-1 space-y-3">
                  @if (m.status === 'thinking') {
                    <div class="inline-flex items-center gap-1.5 rounded-2xl rounded-tl-md border border-white/8 bg-ink-950/50 px-4 py-3" role="status">
                      @for (c of dots(m); track $index) {
                        <span class="h-2.5 w-2.5 animate-pulse-soft rounded-full" [style.background]="c" [style.animation-delay]="$index * 0.18 + 's'"></span>
                      }
                      <span class="sr-only">CardIA está escribiendo…</span>
                    </div>
                  }

                  @if (m.html) {
                    <div class="surface prose-cardia px-4 py-3.5 sm:px-5" [innerHTML]="m.html"></div>
                  }

                  @if (m.cards?.length) {
                    <div class="flex gap-3 overflow-x-auto pb-1">
                      @for (c of m.cards; track c.id) {
                        <a [routerLink]="['/tarjetas', c.id]" class="surface w-52 shrink-0 p-2.5 transition hover:border-white/20">
                          <app-card-art [name]="c.name" [institution]="c.institution" [cardClass]="c.card_class" [imageUrl]="c.image_url" [orientation]="c.image_orientation" />
                          <p class="mt-2 truncate text-sm font-semibold text-white">{{ c.name }}</p>
                          <p class="text-xs text-slate-400">{{ c.annual_fee ? money(c.annual_fee) : 'Sin anualidad' }} · {{ pct(c.interest_rate) }}</p>
                        </a>
                      }
                    </div>
                  }

                  @if (m.suggestions?.length && $last) {
                    <div class="flex flex-wrap gap-2">
                      @for (s of m.suggestions; track s) {
                        <button type="button" class="chip" (click)="send(s)">{{ s }}</button>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          }
        </div>

        <form class="border-t border-white/6 p-3 sm:p-4" (ngSubmit)="send(draft)">
          <div class="flex items-end gap-2 rounded-2xl border border-white/10 bg-ink-950/70 p-1.5 transition focus-within:border-brand-400/60 focus-within:ring-4 focus-within:ring-brand-500/15">
            <label for="msg" class="sr-only">Escribe tu pregunta</label>
            <textarea
              id="msg"
              name="msg"
              rows="1"
              class="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-white placeholder:text-slate-500 focus:outline-none"
              placeholder="Pregunta sobre tarjetas, comisiones o conceptos…"
              [(ngModel)]="draft"
              (keydown.enter)="onEnter($event)"
              maxlength="1000"
              [disabled]="busy()"
            ></textarea>
            <button type="submit" class="btn-primary h-10 w-10 !p-0" [disabled]="busy() || !draft.trim()" aria-label="Enviar">
              <app-icon name="send" [size]="16" />
            </button>
          </div>
          <p class="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-slate-500">
            <app-icon name="lock" [size]="12" /> Nunca compartas RFC, CURP, números de tarjeta ni contraseñas. CardIA no los necesita.
          </p>
        </form>
      </section>

      <!-- Lateral: temas + tipos de preguntas -->
      <aside class="space-y-4">
        <div class="surface p-4">
          <h2 class="flex items-center gap-2 text-sm font-semibold"><app-icon name="book" [size]="15" class="text-accent-400" /> Temas para aprender</h2>
          <p class="mt-1 text-xs text-slate-500">Conceptos del glosario oficial de CONDUSEF.</p>
          <div class="mt-3 flex flex-wrap gap-1.5">
            @for (t of topics.value()?.featured ?? []; track t.term) {
              <button type="button" class="chip" (click)="send(t.question)" [disabled]="busy()">{{ t.term }}</button>
            } @empty {
              @for (i of [1, 2, 3, 4, 5, 6]; track i) {
                <span class="skeleton h-7 w-24"></span>
              }
            }
          </div>

          <h2 class="mt-6 text-sm font-semibold">Puedes preguntar sobre</h2>
          <ul class="mt-3 space-y-2">
            @for (t of questionTypes; track t.title) {
              <li>
                <button type="button" class="flex w-full gap-3 rounded-xl p-2 text-left transition hover:bg-white/5" (click)="send(t.q)" [disabled]="busy()">
                  <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg" [style.background]="t.color + '22'" [style.color]="t.color"><app-icon [name]="t.icon" [size]="16" /></span>
                  <span>
                    <span class="block text-sm font-medium text-white">{{ t.title }}</span>
                    <span class="block text-xs text-slate-400">{{ t.desc }}</span>
                  </span>
                </button>
              </li>
            }
          </ul>
        </div>
        <div class="flex gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3.5 text-xs leading-relaxed text-emerald-100/80">
          <app-icon name="shield" [size]="16" class="mt-0.5 text-emerald-300" />
          <p><strong class="text-emerald-200">Sin datos personales.</strong> Para orientarte solo uso tus preguntas y, si quieres, las respuestas de «Encuentra tu tarjeta».</p>
        </div>
      </aside>
    </div>
  `,
})
export class ChatPage {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly scroller = viewChild<ElementRef<HTMLDivElement>>('scroller');
  readonly q = input<string>();

  protected readonly money = money;
  protected readonly pct = pct;
  protected draft = '';
  protected readonly messages = signal<Message[]>(this.readHistory());
  protected readonly busy = signal(false);
  protected readonly topics = rxResource({ stream: () => this.api.chatTopics() });
  protected readonly questionTypes = QUESTION_TYPES;
  private sessionId = localStorage.getItem(SESSION_KEY) ?? this.newSessionId();

  protected readonly starters = [
    { icon: 'book', q: '¿Cómo funciona una tarjeta de crédito?' },
    { icon: 'wallet', q: '¿Qué es el pago mínimo y cómo se calcula?' },
    { icon: 'gift', q: '¿Qué tarjetas no cobran anualidad?' },
    { icon: 'compare', q: 'Compara Black Unlimited y Santander Free' },
  ];

  constructor() {
    effect(() => {
      this.messages();
      queueMicrotask(() => this.scrollDown());
    });
    afterNextRender(() => {
      const q = this.q();
      if (q) {
        this.router.navigate([], { queryParams: {}, replaceUrl: true });
        this.send(q);
      }
    });
  }

  dots(m: Message): string[] {
    const colors = (m.agents ?? []).map((a) => AGENT_COLOR[a]).filter(Boolean);
    return colors.length ? colors : ['#a78bfa', '#f472b6', '#22d3ee'];
  }

  onEnter(e: Event): void {
    const ke = e as KeyboardEvent;
    if (!ke.shiftKey) {
      ke.preventDefault();
      this.send(this.draft);
    }
  }

  async send(text: string): Promise<void> {
    const message = text.trim();
    if (!message || this.busy()) return;
    this.draft = '';
    this.busy.set(true);
    const aid = crypto.randomUUID();
    this.push({ id: crypto.randomUUID(), role: 'user', text: message });
    this.push({ id: aid, role: 'assistant', text: '', status: 'thinking' });

    try {
      // El backend genera y guarda el plan (D8); al usuario solo se le muestran los agentes activos como puntitos.
      const plan = await firstValueFrom(this.api.chatPlan(message, this.sessionId));
      this.patch(aid, { agents: [...new Set(plan.plan.map((s) => s.agent))] });
      const run = await firstValueFrom(this.api.chatExecute(plan.run_id));
      this.patch(aid, {
        text: run.answer,
        html: renderMarkdown(run.answer),
        cards: run.cards,
        suggestions: run.suggestions,
        status: 'done',
      });
    } catch {
      this.patch(aid, {
        status: 'error',
        html: renderMarkdown('> No pude responder en este momento. Inténtalo de nuevo en unos segundos.'),
      });
    } finally {
      this.busy.set(false);
      this.saveHistory();
    }
  }

  newChat(): void {
    this.messages.set([]);
    this.sessionId = this.newSessionId();
    localStorage.removeItem(HISTORY_KEY);
  }

  private push(m: Message): void {
    this.messages.update((list) => [...list, m]);
  }

  private patch(id: string, p: Partial<Message>): void {
    this.messages.update((list) => list.map((m) => (m.id === id ? { ...m, ...p } : m)));
  }

  private scrollDown(): void {
    const el = this.scroller()?.nativeElement;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }

  private newSessionId(): string {
    const id = crypto.randomUUID().slice(0, 18);
    localStorage.setItem(SESSION_KEY, id);
    return id;
  }

  private saveHistory(): void {
    const slim = this.messages()
      .filter((m) => m.status !== 'thinking')
      .slice(-30)
      .map(({ html: _h, ...rest }) => rest);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(slim));
  }

  private readHistory(): Message[] {
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as Message[];
      return raw.map((m) => (m.role === 'assistant' && m.text ? { ...m, html: renderMarkdown(m.text), status: 'done' } : m));
    } catch {
      return [];
    }
  }
}
