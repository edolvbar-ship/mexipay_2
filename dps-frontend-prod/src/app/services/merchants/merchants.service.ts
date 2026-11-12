import { endpoints } from '@/app/config/endpoints.config';
import { utils } from '@/app/utils/utils';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MerchantsInterface, ShowMerchantsInterface} from '@/app/shared/interfaces/merchants.interface';
import { catchError, Observable, throwError, map, tap, BehaviorSubject } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class MerchantsService{

  constructor( private http: HttpClient) {}

  private API_URL: string = utils.buildUrl(endpoints.apiV02, endpoints.merchantUri);

  private dataRecoveredSubject = new BehaviorSubject<any>([])
  dataRecovered$= this.dataRecoveredSubject;

  getMerchants(): Observable<ShowMerchantsInterface[]>{
    return this.http.get<MerchantsInterface[]>(this.API_URL)
      .pipe(
        map(this.getDataTable),
        catchError(error => {
          return throwError(() => error)
        })
      )
  }

  private getDataTable(response: MerchantsInterface[]): ShowMerchantsInterface[] {
    const merchantsList: ShowMerchantsInterface[] = response.map(merchant => {
        return {
            Id: merchant.id_merchant,
            'Token Activación': merchant.token_activation,
            Cliente: merchant.client_name,
            'Nombre Comercio': merchant.name_merchant,
            'Afiliación': merchant.afiliation_number,
            'Banco Adquirente': merchant.bank,
            'Red Lógica': merchant.logical_network,
            'Representante Legal': merchant.representative,
            'Página Web': merchant.url_merchant,
            RFC: merchant.rfc_merchant,
            'Descripción': merchant.description,
            'Selia ID': merchant.selia_id ? merchant.selia_id.toString() : '' // Add Selia ID
        };
    });

    return merchantsList;
}

createNewMerchant(body:any):Observable <any> {
  return this.http.post<any>(this.API_URL, body).pipe(
    tap(response => {
      if(response) {
      }
    }),
    catchError(error => {
      return throwError(() => error);
    })
  )
}

deleteMerchant(body:any):Observable <any> {
  return this.http.post<any>(`${this.API_URL}/delete`, body).pipe(
    catchError(error => {
      return throwError(() => error);
    })
  )
}

getMerchantById(id: number):Observable <any> {
  return this.http.get<any>(`${this.API_URL}/${id}`).pipe(
      tap(response => this.dataRecoveredSubject.next(response)),
      catchError(error => {
        console.error('Error en la petición:', error);
        return throwError(() => error);
      })
    );
  }

  updateMerchant(body:any):Observable <any> {
    return this.http.post<any>(`${this.API_URL}/edit`, body).pipe(
      tap(response => {
        if(response) {
        }
      }),
      catchError(error => {
        return throwError(() => error);
      })
    )
  }

}
