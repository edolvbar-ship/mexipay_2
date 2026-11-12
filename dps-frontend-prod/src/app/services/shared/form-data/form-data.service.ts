import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FormDataService {

  constructor() { }

  private formDataSubject = new BehaviorSubject<any>({});

  formData$ = this.formDataSubject.asObservable();

  getCurrentDataForm() {
    return this.formDataSubject.asObservable();
  }

  setCurrentDataForm(data: any) {
    this.formDataSubject.next(data)
  }

  clearCurrentDataForm() {
    this.formDataSubject.next(null);
  }
}
