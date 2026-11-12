import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { transformedDate, utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';
import { catchError, map, Observable, throwError } from 'rxjs';
import { 
  BinesDataInterface,
  BinesResponse,
  BinesTableInterface
 } from '@/app/shared/interfaces/bines.interface';

@Injectable({
  providedIn: 'root'
})
export class BinesService {

  constructor(private http: HttpClient) { }

  private API_URL = utils.buildUrl(endpoints.apiV02, "");
  
  dataSearch: BinesTableInterface[] = [];

   // Crud functions
   getAllData(): Observable<BinesTableInterface[]> {
    return this.http.get<BinesResponse>(`${this.API_URL}bines?page=1&pageSize=10000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  getDataById(id:string):Observable<any>{
    return this.http.get<BinesResponse>(`${this.API_URL}bines/${id}`)
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
    return this.http.post(`${this.API_URL}bines`, data );
  }

  updateData( id:number, data: any): Observable<any> { 
    return this.http.put(`${this.API_URL}bines/${data.id}`, data );
  }

  deletePersonType (id:number):any {
    return this.http.delete<any>(`${this.API_URL}bines/${id}`)
  }

  getCatalogs():Observable<any>{
    return this.http.get<any>(`${this.API_URL}bines/catalogs`) // pending change catalogs
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

  getUrlUpload():string{
    return `${this.API_URL}bines/upload-file`;
  }

  getDataSearched(search: string): Observable<any[]> {
    return this.getAllData().pipe(
      map( row => this.filterData(search, row))
    )
  }

  private filterData(search: string, data: BinesTableInterface[]): BinesTableInterface[] {
    const searchLower = search.toLowerCase();
    return this.dataSearch = data.filter( item => {
      return (typeof item.id === 'string' && item.id.toLowerCase().includes(searchLower)) ||
        (typeof item.Bin === 'string' && item.Bin.toLowerCase().includes(searchLower)) ||
        (typeof item.Banco === 'string' && item.Banco.toLowerCase().includes(searchLower)) ||
        (typeof item.Producto === 'string' && item.Producto.toLowerCase().includes(searchLower)) ||
        (typeof item.Tipo === 'string' && item.Tipo.toLowerCase().includes(searchLower)) ||
        (typeof item.Procesador === 'string' && item.Procesador.toLowerCase().includes(searchLower)) ||
        (typeof item.Marca === 'string' && item.Marca.toLowerCase().includes(searchLower)) ||
        (typeof item["3ds"] === 'string' && item["3ds"].toLowerCase().includes(searchLower)) ||
        (typeof item["Fecha Creación"] === 'string' && item["Fecha Creación"].toString().includes(searchLower));
      });
  }

  getOptions(response: BinesDataInterface[]): BinesTableInterface[] {
    const responseItem: BinesTableInterface[] = response.map( item => {
      
      return {
        id:  item.id_bin,
        Bin: item.bin,
        Banco: item.bank,
        Producto: item.product,
        Tipo: item.type,
        Procesador: item.processor_name == null ? "Definido por el comercio" : item.processor_name,
        Marca: item.brand,
        "3ds": (item["3DS"]) ? "Si": "No",
        "Fecha Creación": transformedDate(item.creation_date) || '',

      }
    })
    return responseItem;
  }
}
