import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { transformedDate, utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';
import { catchError, map, Observable, throwError } from 'rxjs';
import { 
  TransactionSchemaDataInterface,
  TransactionSchemaResponse, 
  TransactionSchemaTableInterface 
} from '@/app/shared/interfaces/transaction-schema-interface';

@Injectable({
  providedIn: 'root'
})
export class TransactionalSchemasService {

  constructor(private http: HttpClient) { }

  private API_URL = utils.buildUrl(endpoints.apiV02, endpoints.catalogos);
  
  dataSearch: TransactionSchemaTableInterface[] = [];

   // Crud functions
   getPersonType(): Observable<TransactionSchemaTableInterface[]> {
    return this.http.get<TransactionSchemaResponse>(`${this.API_URL}/transactionalSchemas?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  getDataById(id:string):Observable<any>{
    return this.http.get<TransactionSchemaResponse>(`${this.API_URL}/transactionalSchemas?page=1&pageSize=1000`)
      .pipe(
        map(response => {
          const rowFind = response.data.find( item => item.id_esquema_transactional == id);
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
    return this.http.post(`${this.API_URL}/transactionalSchemas`, data);
  }

  updateData( data: any): Observable<any> { 
    return this.http.put(`${this.API_URL}/transactionalSchemas/${data.id}`, data);
  }

  deletePersonType (id:number):any {
    return this.http.delete<any>(`${this.API_URL}/transactionalSchemas/${id}`)
  }

  getDataSearched(search: string): Observable<any[]> {
    return this.getPersonType().pipe(
      map( row => this.filterData(search, row))
    )
  }

  private filterData(search: string, data: TransactionSchemaTableInterface[]): TransactionSchemaTableInterface[] {
    const searchLower = search.toLowerCase();
    return this.dataSearch = data.filter( item => {
      return (typeof item.id === 'string' && item.id.toLowerCase().includes(searchLower)) ||
        (typeof item["Descripción"] === 'string' && item["Descripción"].toLowerCase().includes(searchLower)) ||
        (typeof item["Esquema"] === 'string' && item["Esquema"].toLowerCase().includes(searchLower)) ||
        (typeof item["Fecha creación"] === 'string' && item["Fecha creación"].toString().includes(searchLower));
      });
  }

  getOptions(response: TransactionSchemaDataInterface[]): TransactionSchemaTableInterface[] {
    const responseItem: TransactionSchemaTableInterface[] = response.map( item => {

      return {
        id:  item.id_esquema_transactional,
        "Descripción": item.description,
        "Esquema" : item.esquema,
        "Fecha creación": transformedDate(item.creation_date) || ''
      }
    })
    return responseItem;
  }

  
}
