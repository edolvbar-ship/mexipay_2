import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { AuthResetResponse } from '@/app/shared/interfaces/auth-reset.interface';

@Injectable({
  providedIn: 'root'
})
export class AuthResetService {

  constructor( private http: HttpClient) { }

  private API_URL = utils.buildUrl( endpoints.apiV02, `${endpoints.loginUri}${endpoints.authReset}`);

  postPassword(username: string): Observable<AuthResetResponse> {
    return this.http.post<AuthResetResponse>(this.API_URL, { username }).pipe(
      tap(response => {
      }),
      catchError(error => {
        return throwError(() => new Error('Error en la solicitud'));
      })
    );
  }
}
