import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { utils } from '@/app/utils/utils';
import { endpoints } from '@/app/config/endpoints.config';
import { Countries, CountriesInterface, CountriesOptionsInterface } from '@/app/shared/interfaces/countries';
import { catchError, map, Observable, throwError } from 'rxjs';
import { PersonTypeDataInterface, PersonTypeResponse } from '@/app/shared/interfaces/person-type-interface';
import { SubmitTypeInterface } from '@/app/shared/interfaces/submit-type';

interface StatesResponseInterface {
  data: StatesInterface[]
  pagination: Pagination
}

interface StatesInterface {
  id_state: number
  name: string
  alpha_2_code: string
  alpha_3_code: string
  creation_date: string
  last_update: string
}

interface Pagination {
  total: number
  page: number
  pageSize: number
  pages: number
}

//TODO: ESTO SE PUEDE MEJORAR CON UN METODO Q PASE EL EOMBRE DEL SERVICIO Y UN OBJETO QUE CONTENGA LOS ENDPOINTS, MEJORARÍA TMB LAS PETICIONES DEL COMP PADRE

@Injectable({
  providedIn: 'root'
})
export class CountriesService {

  constructor(private http: HttpClient) { }

  private API_URL = utils.buildUrl(endpoints.apiV02, endpoints.catalogos);
  private API_BASE_URL = endpoints.apiBaseUrl;

    getCountriesNoAuth(): Observable<SubmitTypeInterface> {
      return this.http.get<any>(`${this.API_BASE_URL}/api/iso3166`)
        .pipe(
          map(response => this.getOptions(response.iso)),
          catchError(error => {
            return throwError(() => error);
          })
        );
    }


    getCountries(): Observable<SubmitTypeInterface> {
      return this.http.get<Countries>(`${this.API_URL}/cisoCountries?page=1&pageSize=1000`)
        .pipe(
          map(response => this.getOptions(response.data)),
          catchError(error => {
            return throwError(() => error);
          })
        );
    }

    getPersonType(): Observable<SubmitTypeInterface> {
      return this.http.get<PersonTypeResponse>(`${this.API_URL}/personTypes?page=1&pageSize=1000`)
        .pipe(
          map(response => this.getOptions(response.data)),
          catchError(error => {
            return throwError(() => error);
          })
        );
    }

    getStates(): Observable<SubmitTypeInterface> {
      return this.http.get<StatesResponseInterface>(`${this.API_URL}/cisoStates?page=1&pageSize=1000`)
        .pipe(
          map(response => this.getOptions(response.data)),
          catchError(error => {
            return throwError(() => error);
          })
        );
    }

    getStatesOptions(response: StatesInterface[]): SubmitTypeInterface[] {
      const countriesList: SubmitTypeInterface[] = response.map(option => {
        return {
          id: option.id_state,
          option: option.name
        }
      })
      return countriesList;
    }

    getTransSchemas():Observable<SubmitTypeInterface>{
      return this.http.get<any>(`${this.API_URL}/transactionalSchemas?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
    }

    getMcc():Observable<SubmitTypeInterface>{
      return this.http.get<any>(`${this.API_URL}/merchantCategoryCodes?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
    }

    getMccRaw():Observable<any[]>{
      return this.http.get<any>(`${this.API_URL}/merchantCategoryCodes?page=1&pageSize=1000`)
      .pipe(
        map(response => response.data),
        catchError(error => {
          return throwError(() => error);
        })
      );
    }

    getAcqBank():Observable<SubmitTypeInterface>{
      return this.http.get<any>(`${this.API_URL}/acquirerBanks?page=1&pageSize=100`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
    }

    getLogicalNtw():Observable<SubmitTypeInterface>{
      return this.http.get<any>(`${this.API_URL}/logicalNetworks?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
    }

    getProcessor():Observable<SubmitTypeInterface>{
      return this.http.get<any>(`${this.API_URL}/processors?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
    }

    getProfilTrans():Observable<SubmitTypeInterface>{
      return this.http.get<any>(`${this.API_URL}/transactionProfiles?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
    }

    getisoAggregators():Observable<SubmitTypeInterface>{
      return this.http.get<any>(`${this.API_URL}/isoAggregators?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
    }

    getTaxRgm():Observable<SubmitTypeInterface>{
      return this.http.get<any>(`${this.API_URL}/taxRegimens?page=1&pageSize=1000`)
      .pipe(
        map(response => this.getOptions(response.data)),
        catchError(error => {
          return throwError(() => error);
        })
      );
    }

    getOptions(response: any[]): SubmitTypeInterface {
      const dataList: SubmitTypeInterface = response.reduce((obj: {[key:string]: any}, option) => {
        const defaultId = option.id;
        const defaultName = option.name;
        const customId = {
          id_tipo_persona: option.id_tipo_persona,
          id_country: option.id_country,
          id_state: option.id_state,
          id_esquema_transactional: option.id_esquema_transactional,
          id_mcc: option.id_mcc,
          id_acqbank: option.id_acqbank,
          id_ln: option.id_ln,
          id_processor: option.id_processor,
          id_profile_transaction: option.id_profile_transaction,
          logicalName: option.logicalName,
          country: option.alpha3
        };
        const customName = {
          esquema : option.esquema,
          coutry: option.country,
          mcc: `${option.mcc} - ${option.description}`,
          tax_code: `${option.tax_code} - ${option.description}`
        }
        const id = Object.values(customId).find(val => val !== undefined) || defaultId;
        const name = Object.values(customName).find(val => val !== undefined && !`${val}`.includes('undefined')) || defaultName;

        obj[name] = id;

        return obj;
      }, {});
      return dataList;
    }


}
