import { endpoints } from '@/app/config/endpoints.config';
import { UsersTDMServiceInterface, CreateNewTDMOnterface, ShowTDMDataInterface, DataUsersTDMServiceInterface } from '@/app/shared/interfaces/users-tdm-service.interface';
import { utils } from '@/app/utils/utils';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, of, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsersTDMService {

  constructor(private http: HttpClient) { }

  private API_URL = utils.buildUrl(endpoints.apiV02, endpoints.usersTDM);
  private dataRecoveredSubject = new BehaviorSubject<DataUsersTDMServiceInterface[]>([])
  dataSearch: ShowTDMDataInterface[] = [];
  dataRecovered$= this.dataRecoveredSubject;

  getUsersTDM(): Observable<DataUsersTDMServiceInterface[]> {
    return this.http.get<UsersTDMServiceInterface>(this.API_URL)
      .pipe(
        map(response => response.users),
        catchError(error => throwError(() => error))
      );
  }
  

  deleteUserTDM(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`)
  }

  postCreateNewTDM (body: any):Observable<CreateNewTDMOnterface>{
    return this.http.post<CreateNewTDMOnterface>(this.API_URL, body)
    .pipe(
      tap(response => {
        if(response) {
        }
      }),
      catchError((error: HttpErrorResponse) => {
        const errorMessage = error.error?.message || 'Error desconocido. Intenta de nuevo más tarde.';
        return throwError(() => new Error(errorMessage));
      })
    )
  }

  formatDateToDMY(dateString: string): string {
    if(!dateString) {
      return ''
    } else {
      const datePart = dateString.split('T')[0];
      const dateObj = new Date(datePart);
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${day}-${month}-${year}`;
    }
  }

  updateUserTDM(id: any, body: any) {
    return this.http.put<any>(`${this.API_URL}/${id}`, body)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          const errorMessage = error.error?.message || 'Error desconocido. Intenta de nuevo más tarde.';
          return throwError(() => new Error(errorMessage));
        })
      )
  }

}
