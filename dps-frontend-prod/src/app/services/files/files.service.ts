import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { transformedDate, utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';
import { catchError, map, Observable, throwError } from 'rxjs';
import { FilesDataInterface, FilesResponse, FilesTableInterface } from '@/app/shared/interfaces/files.interface';

@Injectable({
  providedIn: 'root'
})
export class FilesService {

  constructor(private http: HttpClient) { }

  dataSearch: any[] = [];
  private API_URL = utils.buildUrl(endpoints.apiV02, "");

  getData(type:number):Observable<any>{
    return this.http.post<FilesResponse>(`${this.API_URL}files/getDT`, { type })
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  getUrlUpload():string{
    return `${this.API_URL}files/process`;
  }

  getDataSearched(search: string, type:number): Observable<any[]> {
    return this.getData(type).pipe(
      map( row => this.filterData(search, row))
    )
  }

  private filterData(search: string, data: FilesTableInterface[]): FilesTableInterface[] {
    const searchLower = search.toLowerCase();
    return this.dataSearch = data.filter( item => {
      return (typeof item.Fecha === 'string' && item.Fecha.toLowerCase().includes(searchLower)) ||
        (typeof item.Nombre === 'string' && item.Nombre.toLowerCase().includes(searchLower)) ||
        (typeof item.Porcentaje === 'string' && item.Porcentaje.toLowerCase().includes(searchLower)) ||
        (typeof item.Estatus === 'string' && item.Estatus.toLowerCase().includes(searchLower));
      });
  }

  getOptions(response: FilesDataInterface[]): FilesTableInterface[] {
    const responseItem: FilesTableInterface[] = response.map( item => {
      
      return {
        id: item.id,
        Fecha: transformedDate(item.created_at) || '',
        Nombre: item.nombre,
        Porcentaje: `% ${item.porcentaje}`,
        Estatus: this.getStatusText(item.status),
        error: item.error,
        respuesta: item.respuesta
      }
    })
    return responseItem;
  }

  getStatusText(status:string){
    let label = 'Error';

    if(status == '3'){
      label = "Procesado"
    }

    if(status == '2'){
      label = "Pendiente"
    }
  
    return label;
  }

  getFileById(id:string|number) : Observable<any>{
    return this.http.get<any>(`${this.API_URL}files/${id}`)
      .pipe(
        map(response => response),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }


}
