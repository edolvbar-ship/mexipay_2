import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GetInfoResponse } from '@/app/shared/interfaces/about-interface';

@Injectable({
  providedIn: 'root'
})
export class AboutService {
  getInfo(): Observable<GetInfoResponse>{
    const observable = new Observable<GetInfoResponse>((observer) => {
      observer.next({
        version: '2.0.0',
        processors: []
      });
      observer.complete();
    });
    console.log("observable creado");
    return observable;
  }

}
