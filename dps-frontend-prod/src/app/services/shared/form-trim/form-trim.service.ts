import { Injectable } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FormTrimService {

  constructor() { }

  trimFormValues(form: FormGroup): Subscription {
    return form.valueChanges.subscribe(values => {
      Object.keys(values).forEach(key => {
        if (typeof values[key] === 'string') {
          const trimmedValue = values[key].trim();
          if (values[key] !== trimmedValue) {
            form.get(key)?.setValue(trimmedValue, { emitEvent: false });}        
        }
      });
    });
  }

}
