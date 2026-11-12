import { endpoints } from '@/app/config/endpoints.config';
import { ProfilesServiceInterface, ShowProfilesInterfaces } from '@/app/shared/interfaces/profiles-service.interface';
import { transformedDate, utils } from '@/app/utils/utils';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, tap, throwError } from 'rxjs';


export interface Root {
  data: Profile[];
  message: string;
}

export interface Profile {
  id: number;
  icon: any;
  father_resource?: number;
  resource_name: string;
  resource_url: string;
  isF: number;
  isConfig: number;
  isCrud: number;
  isGroup: number;
  justPage: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: any;
}
@Injectable({
  providedIn: 'root'
})
export class ProfilesService {

  constructor(private http: HttpClient) { }

  private API_URL: string = utils.buildUrl(endpoints.apiV02, endpoints.profiles);
  dataSearch: ShowProfilesInterfaces[] = [];

  getProfiles(): Observable<ShowProfilesInterfaces[]> {
    return this.http.get<ProfilesServiceInterface>(this.API_URL).pipe(
        map(response => {
            return this.getDataTable(response);
        }),
        catchError(error => {
            console.error('Error fetching profiles:', error);
            return throwError(() => error);
        })
    );
}

private getDataTable(response: ProfilesServiceInterface): ShowProfilesInterfaces[] {
    if (!response.data || !Array.isArray(response.data)) {
        console.error('Data is not an array or is undefined:', response.data);
        return []; 
    }

    const profilesList: ShowProfilesInterfaces[] = response.data.map(profile => {
        const createdAt = profile.created_at ? transformedDate(profile.created_at) : ''; // Convertir null a cadena vacía

        return {
            Id: profile.id_profile,
            Nombre: profile.profile_name,
            Comentarios: profile.comments,
            Creado: createdAt // Aquí solo se asigna un string
        };
    });

    return profilesList;
}




  getDataSearched(search: string): Observable<ShowProfilesInterfaces[]> {
    return this.getProfiles().pipe(
      map(profiles => this.filterData(search, profiles))
    );
  }

  private filterData(search: string, profiles: ShowProfilesInterfaces[]): ShowProfilesInterfaces[] {
    return this.dataSearch = profiles.filter(profile =>
        profile.Id.toString().toLowerCase().includes(search.toLowerCase()) ||
        profile.Nombre.toLowerCase().includes(search.toLowerCase()) ||
        profile.Comentarios.toLowerCase().includes(search.toLowerCase()) ||
        (profile.Creado && profile.Creado.toLowerCase().includes(search.toLowerCase()))
    );
}


    getProfilesResouces(): Observable<Root>{
      return this.http.get<Root>(`${this.API_URL}/resources`)
    }

    postCreateProfile(body: any): Observable<any> {
      return this.http.post(this.API_URL, body)
      .pipe(
        tap(response => {
          if(response) {
          }
        }),
        catchError(error => {
          return throwError(() => error)
        })
      )
    };

    deleteProfile(id: number):Observable<void>{
      return this.http.delete<void>(`${this.API_URL}/${id}`)
    }

    getProfileById(id: string | number): Observable<any> {
      return this.http.get<any>(`${this.API_URL}/${id}`)
    }
    

    updateProfile(id: any, body: any): Observable<void>{
      return this.http.put<any>(`${this.API_URL}/${id}`, body).pipe(
        tap(),
        catchError(error => {
          return throwError(() => error)
        })
      )
    }

    getProfilesResoucesById(id:number): Observable<Root>{
      return this.http.get<Root>(`${this.API_URL}/resources/${id}`)
    }
}
