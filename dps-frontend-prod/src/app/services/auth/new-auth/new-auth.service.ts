import { endpoints } from '@/app/config/endpoints.config';
import { AuthCreateNewPassResponse } from '@/app/shared/interfaces/auth-reset.interface';
import { utils } from '@/app/utils/utils';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NewAuthService {

  constructor(private http: HttpClient) { }

  private API_URL = utils.buildUrl(endpoints.apiV02, `${endpoints.loginUri}${endpoints.authNewPs}`);

  postNewPassword(tkn: string, type: string, password: string): Observable<AuthCreateNewPassResponse> {
    return this.http.post<AuthCreateNewPassResponse>(this.API_URL, {tkn, type, password }).pipe(
      tap(response => {

      }),
      catchError(error => {
        return throwError(() => new Error('Error en la solicitud'));
      })
    );
  }
}
