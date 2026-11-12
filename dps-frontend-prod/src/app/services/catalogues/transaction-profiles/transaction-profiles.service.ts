import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { transformedDate, utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';
import { catchError, map, Observable, throwError } from 'rxjs';
import {
  TransactionalProfileDataInterface,
  TransactionalProfileResponse,
  TransactionalProfileTableInterface
} from '@/app/shared/interfaces/transaction-profile-interface';

@Injectable({
  providedIn: 'root'
})
export class TransactionProfilesService {

  constructor(private http: HttpClient) { }

  private API_URL = utils.buildUrl(endpoints.apiV02, endpoints.catalogos);
  private API_URL_CLEATR = utils.buildUrl(endpoints.apiV02, "");

  dataSearch: TransactionalProfileTableInterface[] = [];

   // Crud functions
   getAllData(): Observable<TransactionalProfileTableInterface[]> {
    return this.http.get<TransactionalProfileResponse>(`${this.API_URL}/transactionProfiles?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  getDataById(id:string):Observable<any>{
    return this.http.get<TransactionalProfileResponse>(`${this.API_URL_CLEATR}/transactionalProfiles/${id}`)
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
    const { name, hexValue } = data;
    return this.http.post(`${this.API_URL}/transactionProfiles`, { hexValue , name });
  }

  updateData( data: any): Observable<any> {
    const { name, hexValue } = data
    return this.http.put(`${this.API_URL}/transactionProfiles/${data.id}`, { hexValue } );
  }

  deletePersonType (id:number):any {
    return this.http.delete<any>(`${this.API_URL}/transactionProfiles/${id}`)
  }

  getCatalogs():Observable<any>{
    return this.http.get<any>(`${this.API_URL_CLEATR}/transactionalProfiles/catalogs`)
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

  getDataSearched(search: string): Observable<any[]> {
    return this.getAllData().pipe(
      map( row => this.filterData(search, row))
    )
  }

  private filterData(search: string, data: TransactionalProfileTableInterface[]): TransactionalProfileTableInterface[] {
    const searchLower = search.toLowerCase();
    return this.dataSearch = data.filter( item => {
      return (typeof item.id === 'string' && item.id.toLowerCase().includes(searchLower)) ||
        (typeof item["Nombre"] === 'string' && item["Nombre"].toLowerCase().includes(searchLower)) ||
        (typeof item["Fecha actualización"] === 'string' && item["Fecha actualización"].toLowerCase().includes(searchLower)) ||
        (typeof item["Fecha creación"] === 'string' && item["Fecha creación"].toString().includes(searchLower));
      });
  }

  getOptions(response: TransactionalProfileDataInterface[]): TransactionalProfileTableInterface[] {
    const responseItem: TransactionalProfileTableInterface[] = response.map( item => {

      return {
        id:  item.id_profile_transaction,
        "Nombre": item.name,
        "Fecha creación": transformedDate(item.creation_date) || '',
        "Fecha actualización": transformedDate(item.last_update ?? '') || '',
        decoded: item.decoded
      }
    })
    return responseItem;
  }


}
