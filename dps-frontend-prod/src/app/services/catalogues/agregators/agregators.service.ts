import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { transformedDate, utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';
import { catchError, map, Observable, throwError } from 'rxjs';
import { 
  AgregatorDataInterface,
  AgregatorResponse,
  AgregatorTableInterface
 } from '@/app/shared/interfaces/agregator-interface';



@Injectable({
  providedIn: 'root'
})
export class AgregatorService {

  constructor(private http: HttpClient) { }

  private API_URL = utils.buildUrl(endpoints.apiV02, endpoints.catalogos);
  
  dataSearch: AgregatorTableInterface[] = [];

   // Crud functions
   getAllData(): Observable<AgregatorTableInterface[]> {
    return this.http.get<AgregatorResponse>(`${this.API_URL}/isoAggregators?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  getDataById(id:string):Observable<any>{
    return this.http.get<AgregatorResponse>(`${this.API_URL}/isoAggregators?page=1&pageSize=1000`)
      .pipe(
        map(response => {
          const rowFind = response.data.find( item => item.id == id);
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
    return this.http.post(`${this.API_URL}/isoAggregators`, data);
  }

  updateData( data: any): Observable<any> { 
    const { name } = data
    return this.http.put(`${this.API_URL}/isoAggregators/${data.id}`, { name } );
  }

  deletePersonType (id:number):any {
    return this.http.delete<any>(`${this.API_URL}/isoAggregators/${id}`)
  }

  getDataSearched(search: string): Observable<any[]> {
    return this.getAllData().pipe(
      map( row => this.filterData(search, row))
    )
  }

  private filterData(search: string, data: AgregatorTableInterface[]): AgregatorTableInterface[] {
    const searchLower = search.toLowerCase();
    return this.dataSearch = data.filter( item => {
      return (typeof item.id === 'string' && item.id.toLowerCase().includes(searchLower)) ||
        (typeof item["Nombre"] === 'string' && item["Nombre"].toLowerCase().includes(searchLower)) ||
        (typeof item["ID Agregador"] === 'string' && item["ID Agregador"].toLowerCase().includes(searchLower)) ||
        (typeof item["Fecha creación"] === 'string' && item["Fecha creación"].toString().includes(searchLower));
      });
  }

  getOptions(response: AgregatorDataInterface[]): AgregatorTableInterface[] {
    const responseItem: AgregatorTableInterface[] = response.map( item => {
      
      return {
        id:  item.id,
        "ID Agregador" : item.logicalName,
        "Nombre": item.name,
        "Fecha creación": transformedDate(item.creation_date) || ''
      }
    })
    return responseItem;
  }

  
}
