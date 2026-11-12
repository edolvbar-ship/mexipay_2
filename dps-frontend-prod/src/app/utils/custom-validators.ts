import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Validador que verifica que el valor no contenga caracteres no permitidos
export function forbiddenCharactersValidator(): ValidatorFn {
return (control: AbstractControl): ValidationErrors | null => {
    const forbiddenPattern = /[{}[\]<>=$#@?|''``]/; 
    const value = control.value;

    return value && forbiddenPattern.test(value) ? { forbiddenCharacters: true } : null;
};
}
