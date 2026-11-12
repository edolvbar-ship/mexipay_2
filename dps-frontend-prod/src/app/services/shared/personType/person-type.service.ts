import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';
import { catchError, map, Observable, throwError } from 'rxjs';
import { PersonTypeDataInterface, PersonTypeResponse } from '@/app/shared/interfaces/person-type-interface';
import { SubmitTypeInterface } from '@/app/shared/interfaces/submit-type';

@Injectable({
  providedIn: 'root'
})
export class PersonTypeService {

  constructor(private http: HttpClient) { }
  private API_URL = utils.buildUrl(endpoints.apiV02, endpoints.catalogos);

  getPersonType(): Observable<SubmitTypeInterface[]> {
    return this.http.get<PersonTypeResponse>(`${this.API_URL}personTypes?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  getOptions(response: PersonTypeDataInterface[]): SubmitTypeInterface[] {
    const countriesList: any[] = response.map(option => {
      return {
        id: option.id_tipo_persona,
        option: option.name
      }
    })
    return countriesList;
  }

}
