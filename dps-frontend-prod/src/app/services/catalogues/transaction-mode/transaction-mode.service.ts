import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { transformedDate, utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';
import { catchError, map, Observable, throwError } from 'rxjs';
import { 
  LogicalNetworkDataInterface,
  LogicalNetworkResponse,
  LogicalNetworkTableInterface
 } from '@/app/shared/interfaces/logical-network-interface';
import { UrlTargetDataInterface, UrlTargetResponse, UrlTargetTableInterface } from '@/app/shared/interfaces/url-target-interface';
import { TransactionModeDataInterface, TransactionModeResponse, TransactionModeTableInterface } from '@/app/shared/interfaces/transaction-mode.interface';

@Injectable({
  providedIn: 'root'
})
export class TransactionModeService {

  constructor(private http: HttpClient) { }

  private API_URL = utils.buildUrl(endpoints.apiV02, endpoints.catalogos);
  
  dataSearch: TransactionModeTableInterface[] = [];

   // Crud functions
   getAllData(): Observable<TransactionModeTableInterface[]> {

    return this.http.get<TransactionModeResponse>(`${this.API_URL}/transactionModes?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  getDataById(id:string):Observable<any>{
    return this.http.get<TransactionModeResponse>(`${this.API_URL}/transactionModes/${id}`)
      .pipe(
        map(response => {
          return response;
        },
        catchError(error => {
          return throwError(() => error);
        })
      )
    );
  }

  saveData( data: any): Observable<any> { 
    return this.http.post(`${this.API_URL}/transactionModes`, data);
  }

  updateData( data: any): Observable<any> { 
    const { 
      description
     } = data
    return this.http.put(`${this.API_URL}/transactionModes/${data.id}`, { description } );
  }

  deletePersonType (id:number):any {
    return this.http.delete<any>(`${this.API_URL}/transactionModes/${id}`)
  }

  getDataSearched(search: string): Observable<any[]> {
    return this.getAllData().pipe(
      map( row => this.filterData(search, row))
    )
  }

  private filterData(search: string, data: TransactionModeTableInterface[]): TransactionModeTableInterface[] {
    const searchLower = search.toLowerCase();
    return this.dataSearch = data.filter( item => {
      return (typeof item.id === 'string' && item.id.toLowerCase().includes(searchLower)) ||
        (typeof item["Modo"] === 'string' && item["Modo"].toLowerCase().includes(searchLower)) ||
        (typeof item["Descripción"] === 'string' && item["Descripción"].toLowerCase().includes(searchLower)) ||
        (typeof item["Fecha creación"] === 'string' && item["Fecha creación"].toString().includes(searchLower)) ||
        (typeof item["Fecha actualización"] === 'string' && item["Fecha actualización"].toString().includes(searchLower));
      });
  }

  getOptions(response: TransactionModeDataInterface[]): TransactionModeTableInterface[] {
    const responseItem: TransactionModeTableInterface[] = response.map( item => {
      

      return {
        id:  item.id_bnrg_modo_transac,
        "Modo" : item.bnrg_modo_trans,
        "Descripción" : item.description,
        "Fecha creación": transformedDate(item.creation_date) || '',
        "Fecha actualización": transformedDate(item.last_update ?? '') || ''
      }
    })
    return responseItem;
  }


}
