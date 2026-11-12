import { endpoints } from '@/app/config/endpoints.config';
import { utils } from '@/app/utils/utils';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ContrachargesService {

  constructor(
    private http: HttpClient
  ) { }

  private API_URL: string = utils.buildUrl(endpoints.apiV02, endpoints.movements);
  dataSearch: any[] = [];

  getMovements(body: any): Observable<any[]>{
    return this.http.post<any>(`${this.API_URL}/chargebacks`, body).pipe(
      //map(this.getDataTable),
      tap(response => {return response}),
      catchError(error => {
        return throwError(() => error);
      }

      )
    )
  }

  private getDataTable(response: any): any[] {
    const dataList: any[] = response.data.map( (movements: any) => {
      return  {
        Id: movements.name,
        Fecha: movements.name,
        'Fecha Cargo': movements.name,
        'Afiliación': movements.name,
        'Tipo CC': movements.name,
        Monto: movements.name,
        Referencia: movements.name,
        'Autorización': movements.name,
        'Razón': movements.name,
        Folio: movements.name,
        Comentarios: movements.name
      }
    })
    return dataList;
  }

}
