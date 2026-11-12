import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";

export function dateBefore(date: Date): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const controlDate = new Date(control.value) < date;
        return controlDate ? {dateBefore: {value: control.value}} : null;
    }
}

export function expireAfter(date: Date): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        if(!/(0[1-9]|1[0-2])\/[0-9]{2}/.test(control.value)){
            return null;
        }
        const dateParts = control.value.split('/');
        const expireDate = new Date(parseInt(dateParts[1])+2000,parseInt(dateParts[0])-1);
        const controlDate = expireDate < date;
        return controlDate ? {expireAfter: {value: control.value}} : null;
    }
}