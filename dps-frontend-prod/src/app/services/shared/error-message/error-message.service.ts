import { Injectable } from '@angular/core';
import { AbstractControl, NgControl, ValidationErrors } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class ErrorMessageService {

  constructor() { }

  // Define global error messages
  private errorMessages: { [key: string]: (error: ValidationErrors) => string } = {
    required: () => 'Este campo es requerido',
    minlength: (error) => `Debe contener mínimo ${error['requiredLength']} caracteres`,
    maxlength: (error) => `Debe contener máximo ${error['requiredLength']} caracteres`,
    pattern: () => 'Formato inválido',
    email: () => 'Ingresa un email válido',
    expireAfter: () => 'Expirada',
    hasUppercase: () => 'Debe contener al menos una mayúscula',
    hasLowercase: () => 'Debe contener al menos una minúscula',
    hasNumber: () => 'Debe contener al menos un número',
    hasSpecial: (error) => `Debe contener al menos uno de los sig. caracteres ${error['needed']}`,
  };

  // Method to get the first error message
  getErrorMessage(control: AbstractControl | null): string | null {
    if (control?.errors) {
      const firstErrorKey = Object.keys(control.errors)[0]; // Get the first error key
      const getErrorMessage = this.errorMessages[firstErrorKey]; // Lookup the message
      if (getErrorMessage) {
        return getErrorMessage(control.errors[firstErrorKey]); // Return the error message
      }else {
        return 'Campo inválido'
      }
    }
    return null;
  }
}
