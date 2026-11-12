import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { transformedDate, utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';
import { catchError, map, Observable, throwError } from 'rxjs';

import { 
  BusinessDataInterface,
  BusinessResponse,
  BusinessTableInterface
 } from '@/app/shared/interfaces/business-interface';

@Injectable({
  providedIn: 'root'
})
export class BusinessService {

  constructor(private http: HttpClient) { }

  private API_URL = utils.buildUrl(endpoints.apiV02, endpoints.catalogos);
  
  dataSearch: BusinessTableInterface[] = [];

   // Crud functions
   getAllData(): Observable<BusinessTableInterface[]> {
    return this.http.get<BusinessResponse>(`${this.API_URL}/merchantCategoryCodes?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  getDataById(id:string):Observable<any>{
    return this.http.get<BusinessResponse>(`${this.API_URL}/merchantCategoryCodes?page=1&pageSize=1000`)
      .pipe(
        map(response => {
          const rowFind = response.data.find( item => item.id_mcc == id);
          if (rowFind) {
            return rowFind;
          } else {
            throw new Error(`No se encontró información con ID ${id}`);
          }
        },
        catchError(error => {
          return throwError(() => error);
        })
      )
    );
  }

  saveData( data: any): Observable<any> { 
    return this.http.post(`${this.API_URL}/merchantCategoryCodes`, data);
  }

  updateData( data: any): Observable<any> { 
    const { mcc, description, active } = data
    return this.http.put(`${this.API_URL}/merchantCategoryCodes/${data.id}`, { description, active } );
  }

  deletePersonType (id:number):any {
    return this.http.delete<any>(`${this.API_URL}/merchantCategoryCodes/${id}`)
  }

  getDataSearched(search: string): Observable<any[]> {
    return this.getAllData().pipe(
      map( row  => this.filterData(search, row))
    )
  }

  private filterData(search: string, data: BusinessTableInterface[]): BusinessTableInterface[] {
    const searchLower = search.toLowerCase();
    return this.dataSearch = data.filter( item => {
      return (typeof item.id === 'string' && item.id.toLowerCase().includes(searchLower)) ||
        (typeof item["Descripción"] === 'string' && item["Descripción"].toLowerCase().includes(searchLower)) ||
        (typeof item["Giro"] === 'string' && item["Giro"].toLowerCase().includes(searchLower)) ||
        (typeof item["Fecha creación"] === 'string' && item["Fecha creación"].toString().includes(searchLower));
      });
  }

  getOptions(response: BusinessDataInterface[]): BusinessTableInterface[] {
    const responseItem: BusinessTableInterface[] = response.map( item => {
      return {
        id:  item.id_mcc,
        Giro : item.mcc,
        "Descripción": item.description,
        "Fecha creación": transformedDate(item.create_date) || ''
      }
    })
    return responseItem;
  }

  
}
