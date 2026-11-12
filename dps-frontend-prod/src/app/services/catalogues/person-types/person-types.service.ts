import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { transformedDate, utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';
import { catchError, map, Observable, throwError } from 'rxjs';
import { PersonTypeDataInterface, PersonTypeResponse, PersonTypeTableInterface } from '@/app/shared/interfaces/person-type-interface';

@Injectable({
  providedIn: 'root'
})
export class PersonTypeService {

  constructor(private http: HttpClient) { }

  private API_URL = utils.buildUrl(endpoints.apiV02, endpoints.catalogos);
  
  dataSearch: PersonTypeTableInterface[] = [];

  // Crud functions
  getPersonType(): Observable<PersonTypeTableInterface[]> {
    return this.http.get<PersonTypeResponse>(`${this.API_URL}/personTypes?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  getDataById(id:string):Observable<any>{
    return this.http.get<PersonTypeResponse>(`${this.API_URL}/personTypes?page=1&pageSize=1000`)
      .pipe(
        map(response => {
          const personType = response.data.find( person => person.id_tipo_persona == id);
          if (personType) {
            return personType;
          } else {
            throw new Error(`PersonType con ID ${id} no encontrado`);
          }
        },
        catchError(error => {
          return throwError(() => error);
        })
      )
    );
  }

  saveData( data: any): Observable<any> { 
    return this.http.post(`${this.API_URL}/personTypes`, data);
  }

  updateData( data: any): Observable<any> { 
    return this.http.put(`${this.API_URL}/personTypes/${data.id}`, data);
  }

  deletePersonType (id:number):any {
    return this.http.delete<any>(`${this.API_URL}/personTypes/${id}`)
  }

  getDataSearched(search: string): Observable<any[]> {
    return this.getPersonType().pipe(
      map( row => this.filterData(search, row))
    )
  }

  private filterData(search: string, data: PersonTypeTableInterface[]): PersonTypeTableInterface[] {
    const searchLower = search.toLowerCase();
    return this.dataSearch = data.filter( item => {
      return (typeof item.id === 'string' && item.id.toLowerCase().includes(searchLower)) ||
        (typeof item["Nombre"] === 'string' && item["Nombre"].toLowerCase().includes(searchLower)) ||
        (typeof item["Fecha creación"] === 'string' && item["Fecha creación"].toString().includes(searchLower));
      });
  }

  getOptions(response: PersonTypeDataInterface[]): PersonTypeTableInterface[] {
    const responseItem: PersonTypeTableInterface[] = response.map( item => {
      
      return {
        id:  item.id_tipo_persona,
        "Nombre": item.name,
        "Fecha creación": transformedDate(item.creation_date) || ''
      }
    })
    return responseItem;
  }



}
