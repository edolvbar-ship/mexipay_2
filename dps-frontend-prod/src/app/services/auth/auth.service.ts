import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { UserInfo } from '@/app/shared/interfaces/user-info.interface';
import { LoginResponseInterface } from '@/app/shared/interfaces/login-response.interface';
import { endpoints } from '@/app/config/config';
import { utils } from '@/app/utils/utils';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  //TODO: Proteger rutas con importacion
  private API_URL = utils.buildUrl( endpoints.apiV02, endpoints.loginUri );
  private tokenKey = 'authToken';
  private loginResponse : LoginResponseInterface | null = null;
  private _sessionExpired = false;



  constructor( private http: HttpClient, private router: Router ) {

  }

  //TODO: crear las  interfaces
  //TODO: GENERAR UN SERVICIO DE ENCRIPTADO PARA AÑADIR INJECTAR LA ENCRIPTACIÓN

  login(username: string, password: string): Observable<LoginResponseInterface> {
    return this.http.post<LoginResponseInterface>(this.API_URL, { username, password }).pipe(
      tap(response => {
        if (response.token) {
          this.storeToken(response.token);
          this.loginResponse = response;
        }
      }),
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Ocurrió un error inesperado';
        if (error.error) {
          if (error.error.text) {
            errorMessage = error.error.text;
          }
        }
        return throwError(() => new Error(errorMessage));
      })
    );
  }


  get userInfo(): UserInfo | null {
    if (!this.loginResponse) {
      // Try to restore login response from token
      this.restoreLoginResponseFromToken();
    }
    
    if (!this.loginResponse) {
      return null;
    }
    
    return {
      fullName: this.loginResponse?.user.fullName ?? '',
      mail: this.loginResponse?.user.mail ?? '',
      userProfile: this.loginResponse?.user.id_profile ?? 0,
      username: this.loginResponse?.user.username ?? '',
      isAdmin: (this.loginResponse?.user.is_admin ?? 0) == 1 ? true : false,
      idClient: this.loginResponse?.user.id_cliente,
      telephone: this.loginResponse.user.telephone,
      name: this.loginResponse.user.name,
      last_name: this.loginResponse.user.last_name
    }
  }

  private restoreLoginResponseFromToken(): void {
    try {
      const token = this.getToken();
      if (!token) return;
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // Create a mock login response from token payload
      this.loginResponse = {
        token: token,
        license: payload.license || null,
        user: {
          ...payload,
          is_admin: payload.is_admin || 0
        }
      };
      
      console.log('🔄 Restored login response from token:', this.loginResponse);
    } catch (error) {
      console.error('❌ Failed to restore login response from token:', error);
    }
  }

  //TODO: Validar si necesitarás el token disponible, local storage no es seguro

  public storeToken(token: string): void {
    try {
      if (!token) {
        console.error('❌ No token provided to store');
        return;
      }
      
      console.log('🔐 Storing token:', token.substring(0, 20) + '...');
      
      // Store token with timestamp for 5-hour session management
      const tokenData = {
        token: token,
        storedAt: Date.now(),
        expiresAt: Date.now() + (5 * 60 * 60 * 1000) // 5 hours from now
      };
      
      localStorage.setItem(this.tokenKey, JSON.stringify(tokenData));
      // Also store raw token for backward compatibility
      localStorage.setItem('rawToken', token);
      
      console.log('✅ Token stored successfully');
      console.log('📝 Metadata:', tokenData);
      console.log('🔑 Raw token stored:', localStorage.getItem('rawToken')?.substring(0, 20) + '...');
    } catch (error) {
      console.error('❌ Failed to store token', error);
    }
  }

  public getToken(): string | null {
    try {
      const tokenDataStr = localStorage.getItem(this.tokenKey);
      const rawToken = localStorage.getItem('rawToken');
      
      console.log('🔍 Getting token...');
      console.log('📝 Metadata string:', tokenDataStr);
      console.log('🔑 Raw token:', rawToken?.substring(0, 20) + '...');
      
      // IMPORTANT: Always return the raw token if available
      if (rawToken) {
        console.log('✅ Returning raw token:', rawToken.substring(0, 20) + '...');
        return rawToken;
      }
      
      if (!tokenDataStr) {
        console.log('⚠️ No metadata found and no raw token');
        return null;
      }
      
      const tokenData = JSON.parse(tokenDataStr);
      
      // Check if 5-hour session has expired
      if (Date.now() > tokenData.expiresAt) {
        console.log('⏰ Token expired, clearing session');
        this.expireSession();
        return null;
      }
      
      console.log('✅ Returning token from metadata:', tokenData.token?.substring(0, 20) + '...');
      return tokenData.token;
    } catch (error) {
      console.error('❌ Failed to get token', error);
      // Fallback to raw token
      const rawToken = localStorage.getItem('rawToken');
      console.log('🔄 Fallback to raw token:', rawToken?.substring(0, 20) + '...');
      return rawToken;
    }
  }


  //TODO: se pueden mejorar con decosntructuring

  // isAutenticated(): boolean {
  //   const token = this.getToken();
  //   if(!token) {
  //     return false
  //   }
  //   console.log(token)
  //   const payload = JSON.parse(atob(token.split('.')[1]));
  //   const expiration = payload.exp * 1000;
  //   return Date.now() < expiration;
  // }


  isAutenticated(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiration = payload.exp * 1000;
      return Date.now() < expiration;
    } catch (error) {
      console.error('Failed to parse JWT', error);
      this.expireSession();
      return false;
    }
  }

  logout(): void {
    this.expireSession();
    this.router.navigate(['/login'])
  }

  expireSession(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem('rawToken');
    this._sessionExpired = true;
  }

  isSessionExpired(): boolean {
    return this._sessionExpired;
  }

  clearSessionExpired() {
    this._sessionExpired = false;
  }


}

