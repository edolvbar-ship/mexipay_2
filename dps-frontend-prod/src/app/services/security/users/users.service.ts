import { endpoints } from '@/app/config/endpoints.config';
import { UserServiceInterface, ShowUserSecurityInterface, UserServiceUserInterface, newUserInterface } from '@/app/shared/interfaces/user-service.interface';
import { utils } from '@/app/utils/utils';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UsersService {

  constructor(private http: HttpClient) { }

  private API_URL = utils.buildUrl(endpoints.apiV02, endpoints.users);
  private dataRecoveredSubject = new BehaviorSubject <UserServiceUserInterface[]>([])
  dataSearch: ShowUserSecurityInterface[] = [];
  dataRecovered$= this.dataRecoveredSubject;
  
  getUsers(): Observable<UserServiceUserInterface[]> {
    return this.http.get<UserServiceInterface>(this.API_URL)
      .pipe(
        map(response => response.users),
        tap(users => this.dataRecoveredSubject.next(users)), 
        catchError(error => throwError(() => error))
    );
}


formatDateToDMY(dateString: string | undefined): string {
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

deleteUser(id:number): Observable<void> {
  return this.http.delete<void>(`${this.API_URL}/${id}`)
}

createNewUser(body:any): Observable<any> {
  return this.http.post<any>(this.API_URL, body)
    .pipe(
      tap(response => {
        if(response) {
        }
      }),
      catchError(error => {
        return throwError(() => error)
      })
    )
}

updateUser(id: any, body: any):Observable <any> {
  return this.http.put<any>(`${this.API_URL}/${id}`, body)
  .pipe(
    catchError(error => {
      return throwError(() => error)
    })
  )
}

updateOwnUser(body:any): Observable <any> {
  return this.http.put<any>(`${this.API_URL}/${body.id_user}`, body)
    .pipe(
      catchError(error => {
        console.error(error)
        return throwError(() => error)
      })
    )
}

}
