import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { transformedDate, utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';
import { catchError, map, Observable, throwError } from 'rxjs';


import { 
  BankDataInterface,
  BankResponse,
  BankTableInterface
 } from '@/app/shared/interfaces/bank-interface';

@Injectable({
  providedIn: 'root'
})
export class BankService {

  constructor(private http: HttpClient) { }

  private API_URL = utils.buildUrl(endpoints.apiV02, endpoints.catalogos);
  
  dataSearch: BankTableInterface[] = [];

   // Crud functions
   getAllData(): Observable<BankTableInterface[]> {
    return this.http.get<BankResponse>(`${this.API_URL}/acquirerBanks?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  getDataById(id:string):Observable<any>{
    return this.http.get<BankResponse>(`${this.API_URL}/acquirerBanks?page=1&pageSize=1000`)
      .pipe(
        map(response => {
          const rowFind = response.data.find( item => item.id_acqbank == id);
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
    return this.http.post(`${this.API_URL}/acquirerBanks`, data);
  }

  updateData( data: any): Observable<any> { 
    const { name } = data
    return this.http.put(`${this.API_URL}/acquirerBanks/${data.id}`, { name } );
  }

  deletePersonType (id:number):any {
    return this.http.delete<any>(`${this.API_URL}/acquirerBanks/${id}`)
  }

  getDataSearched(search: string): Observable<any[]> {
    return this.getAllData().pipe(
      map( row => this.filterData(search, row))
    )
  }

  private filterData(search: string, data: BankTableInterface[]): BankTableInterface[] {
    const searchLower = search.toLowerCase();
    return this.dataSearch = data.filter( item => {
      return (typeof item.id === 'string' && item.id.toLowerCase().includes(searchLower)) ||
        (typeof item["Nombre"] === 'string' && item["Nombre"].toLowerCase().includes(searchLower)) ||
        (typeof item["Fiid"] === 'string' && item["Fiid"].toLowerCase().includes(searchLower)) ||
        (typeof item["Fecha creación"] === 'string' && item["Fecha creación"].toString().includes(searchLower));
      });
  }

  getOptions(response: BankDataInterface[]): BankTableInterface[] {
    const responseItem: BankTableInterface[] = response.map( item => {
      
      return {
        id:  item.id_acqbank,
        Fiid : item.fiid,
        "Nombre": item.name,
        "Fecha creación": transformedDate(item.creation_date) || ''
      }
    })
    return responseItem;
  }

  
}
