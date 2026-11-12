import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'inputErrorMessages',
  standalone: true
})
export class InputErrorMessagesPipe implements PipeTransform {

  transform(errors: any, value: string): string {
    if (!errors) return '';

    if (errors.required) {
      return `${value} es requerido.`;
    } else if (errors.email) {
      return `Por favor, ingresa un email válido.`;
    } else if (errors.minlength) {
      return `${value} debe tener al menos ${errors.minlength.requiredLength} caracteres.`;
    } else if (errors.maxlength) {
      return `${value} no puede exceder de ${errors.maxlength.requiredLength} caracteres.`;
    } else if (errors.pattern) {
      return `${value} no tiene un formato válido.`;
    } else if (errors.invalidPhoneNumber) {
      return `El número de teléfono no es válido.`;
    }
    return `Error en el campo ${value}`;
  }
}
