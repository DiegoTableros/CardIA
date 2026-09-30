import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiService } from '../api/api.service';
import type { TokenResponse, UserOut } from '../api/types';

const TOKEN_KEY = 'cardia.token';
const USER_KEY = 'cardia.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly _user = signal<UserOut | null>(this.readUser());

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => !!this._token());
  readonly isAdmin = computed(() => this._user()?.role === 'admin');
  readonly firstName = computed(() => (this._user()?.full_name ?? '').split(' ')[0] || 'Hola');

  login(email: string, password: string): Observable<TokenResponse> {
    return this.api.login(email, password).pipe(
      tap((res) => {
        localStorage.setItem(TOKEN_KEY, res.access_token);
        localStorage.setItem(USER_KEY, JSON.stringify(res.user));
        this._token.set(res.access_token);
        this._user.set(res.user);
      }),
    );
  }

  logout(): void {
    if (this._token()) this.api.logout().subscribe({ error: () => undefined });
    this.clear();
    this.router.navigateByUrl('/login');
  }

  /** Limpia la sesion local (p. ej. ante un 401). */
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
    this.api.resetCache();
  }

  private readUser(): UserOut | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as UserOut) : null;
    } catch {
      return null;
    }
  }
}
