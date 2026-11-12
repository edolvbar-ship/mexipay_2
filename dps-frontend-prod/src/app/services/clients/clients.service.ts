import { endpoints } from '@/app/config/endpoints.config';
import { ClientsInterface, createNewClienteInterface, ShowDataClient } from '@/app/shared/interfaces/clients.interface';
import { utils } from '@/app/utils/utils';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ClientsService {

  constructor(private http: HttpClient) {}

  private API_URL = utils.buildUrl( endpoints.apiV02, endpoints.clients)
  private dataRecoveredSubject = new BehaviorSubject<any>([])
  dataRecovered$= this.dataRecoveredSubject;

  getClients(): Observable<ShowDataClient[]> {
    return this.http.post<ClientsInterface>(`${this.API_URL}/get`, {}) 
      .pipe(
        map(response => this.getDataTable(response)),
        catchError(error => {
          console.error('Error en la petición:', error);
          return throwError(() => error);
        })
      );
  }
  
  getClientById(id: number): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/get`, { id })
      .pipe(
        catchError(error => {
          console.error('Error en la petición:', error);
          return throwError(() => new Error('Error en la petición al obtener cliente'));
        })
      );
  }
  
  
  private getDataTable(response: ClientsInterface): ShowDataClient[] {
    return response.data.map(client => {
      return {
        Id: client.id_client,
        'Nombre Cliente': client.name,
        'Razon Social': client.razon_social,
        'Representante Legal': client.representative,
        RFC: client.rfc,
        'Página Web': client.url,
        'Descripción': client.description,
        Agente: client.agente,
        'Contacto de Cliente': client.contact_cliente,
        'Rol de Contacto': client.rol_contact
      };
    });
  }

  getDataSearched(search: string): Observable<ShowDataClient[]> {
    return this.getClients().pipe(
      map(clients => this.filterData(search, clients))
    );
  }
  
  private filterData(search: string, clients: ShowDataClient[]): ShowDataClient[] {
    const searchLower = search.toLowerCase();
    
    return clients.filter(client => {
        return  client.Id.toString().includes(searchLower) ||
                client.Agente.toLowerCase().includes(searchLower) ||
                client['Nombre Cliente'].toLowerCase().includes(searchLower) ||
                client['Razon Social'].toLowerCase().includes(searchLower) ||
                client['Representante Legal'].toLowerCase().includes(searchLower) ||
                client.RFC.toLowerCase().includes(searchLower) ||
                client['Página Web'].toLowerCase().includes(searchLower) ||
                client['Descripción'].toLowerCase().includes(searchLower) ||
                client['Contacto de Cliente'].toLowerCase().includes(searchLower) ||
                client['Rol de Contacto'].toLowerCase().includes(searchLower);
    });
  }


  postCreateNewClient(data: createNewClienteInterface): Observable<any> {
    return this.http.post<createNewClienteInterface>(`${this.API_URL}`, data).pipe(
      tap(response => {
        if(response) {
        }
      }),
      catchError(error => {
        return throwError(() => error);
      })
    )
  }

  deletClient(id: number): Observable<any>{
    return this.http.post<any>(`${this.API_URL}/delete`, {id:id}).pipe(
      tap(response => {
      }),
      catchError(error => {
        return throwError(() => error);
      })
    )
  }

  updateClient(body: any): Observable<any>{
    return this.http.post<any>(`${this.API_URL}/update`, body).pipe(
      tap(response => {
      }),
      catchError(error => {
        return throwError(() => error);
      })
    )
  }

}
