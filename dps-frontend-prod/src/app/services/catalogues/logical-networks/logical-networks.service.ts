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

@Injectable({
  providedIn: 'root'
})
export class LogicalNetworksService {

  constructor(private http: HttpClient) { }

  private API_URL = utils.buildUrl(endpoints.apiV02, endpoints.catalogos);
  
  dataSearch: LogicalNetworkTableInterface[] = [];

   // Crud functions
   getAllData(): Observable<LogicalNetworkTableInterface[]> {
    return this.http.get<LogicalNetworkResponse>(`${this.API_URL}/logicalNetworks?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  getDataById(id:string):Observable<any>{
    return this.http.get<LogicalNetworkResponse>(`${this.API_URL}/logicalNetworks?page=1&pageSize=1000`)
      .pipe(
        map(response => {
          const rowFind = response.data.find( item => item.id_ln == id);
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
    return this.http.post(`${this.API_URL}/logicalNetworks`, data);
  }

  updateData( data: any): Observable<any> { 
    const { ln, name } = data
    return this.http.put(`${this.API_URL}/logicalNetworks/${data.id}`, { ln, name } );
  }

  deletePersonType (id:number):any {
    return this.http.delete<any>(`${this.API_URL}/logicalNetworks/${id}`)
  }

  getDataSearched(search: string): Observable<any[]> {
    return this.getAllData().pipe(
      map( row => this.filterData(search, row))
    )
  }

  private filterData(search: string, data: LogicalNetworkTableInterface[]): LogicalNetworkTableInterface[] {
    const searchLower = search.toLowerCase();
    return this.dataSearch = data.filter( item => {
      return (typeof item.id === 'string' && item.id.toLowerCase().includes(searchLower)) ||
        (typeof item["Nombre"] === 'string' && item["Nombre"].toLowerCase().includes(searchLower)) ||
        (typeof item["Red Lógica"] === 'string' && item["Red Lógica"].toLowerCase().includes(searchLower)) ||
        (typeof item["Fecha creación"] === 'string' && item["Fecha creación"].toString().includes(searchLower));
      });
  }

  getOptions(response: LogicalNetworkDataInterface[]): LogicalNetworkTableInterface[] {
    const responseItem: LogicalNetworkTableInterface[] = response.map( item => {
      
      return {
        id:  item.id_ln,
        "Red Lógica" : item.ln,
        "Nombre": item.name,
        "Fecha creación": transformedDate(item.creation_date) || ''
      }
    })
    return responseItem;
  }


}
