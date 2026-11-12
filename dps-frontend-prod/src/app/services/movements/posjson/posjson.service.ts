import { endpoints } from '@/app/config/endpoints.config';
import { PosJsonInterface, PosJsonInterfaceData } from '@/app/shared/interfaces/movements/pos-json.interface';
import { transformedTime } from '@/app/utils/transformedData';
import { transformedDate, utils } from '@/app/utils/utils';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PosjsonService {

  constructor(private http: HttpClient) { }

  private API_URL: string = utils.buildUrl(endpoints.apiV02, endpoints.movements);
  dataSearch: any[] = [];

  getPosJSON(body: PosJsonInterface[]): Observable<PosJsonInterfaceData[]>{
    return this.http.post<any>(`${this.API_URL}/posjson`, body).pipe(
      map( (response:any) => response ),
      catchError(err => {
        return throwError(() => err)
      })
    )
  }

  getDataTable(response: any): any[] {
    const dataList: PosJsonInterfaceData[] = response.data.map( (movement: any) => {
      return  {
        Fecha: transformedDate(movement.creation_date) || '',
        Hora: transformedTime(movement.creation_date),
        'Id Request': movement.id_request,
        Referencia: JSON.parse(movement.response).id,
        URI: movement.uri,
        Método: movement.method,
        'Fecha Inicio': transformedDate(movement.entry_time) || '',
        'Fecha Final': transformedDate(movement.exit_time) || '',
      }
    })
    return dataList;
  }

  // search methods
  getDataSearched(search: string, date:any): Observable<any[]> {
    return this.getPosJSON(date).pipe(
      map( (row:any) => {
            return this.filterData(search, row)
          }
      )
    )
  }

  private filterData(search: string, data: any): any {
    const searchLower      = search.toLowerCase();
    this.dataSearch = data.data.filter( (item:any) => {
      return  (typeof item.id_log === 'string' && item.id_log.toLowerCase().includes(searchLower)) ||
              (typeof item.id_transaction === 'string' && item.id_transaction.toLowerCase().includes(searchLower)) ||
              (typeof item.id_request === 'string' && item.id_request.toLowerCase().includes(searchLower)) ||
              (typeof item.uri === 'string' && item.uri.toLowerCase().includes(searchLower)) ||
              (typeof item.method === 'string' && item.method.toLowerCase().includes(searchLower)) ||
              (typeof item.request === 'string' && item.request.toLowerCase().includes(searchLower)) ||
              (typeof item.response === 'string' && item.response.toLowerCase().includes(searchLower)) ||
              (typeof item.entry_time === 'string' && item.entry_time.toLowerCase().includes(searchLower)) ||
              (typeof item.exit_time === 'string' && item.exit_time.toLowerCase().includes(searchLower)) ||
              (typeof item.creation_date === 'string' && item.creation_date.toLowerCase().includes(searchLower)) ||
              (typeof item.fecha_hora === 'string' && item.fecha_hora.toLowerCase().includes(searchLower)) ||
              (typeof item.fecha_ === 'string' && item.fecha_.toLowerCase().includes(searchLower)) ||
              (typeof item.hora_ === 'string' && item.hora_.toLowerCase().includes(searchLower)) ||
              (typeof item.entry_time === 'string' && item.entry_time.toLowerCase().includes(searchLower)) ||
              (typeof item.exit_time === 'string' && item.exit_time.toLowerCase().includes(searchLower));
      });

      return { data: this.dataSearch};
  }


}
