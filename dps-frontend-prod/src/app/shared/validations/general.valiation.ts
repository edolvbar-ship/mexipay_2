import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from "@angular/forms";

/**
 * 
 * @param controlName Name of the control to compare must be in the same group.
 * @returns 
 */
export function sameAs(controlName: string): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const controlToCampare = control.parent?.get(controlName);
        return control.value != controlToCampare?.value ? {sameAs: {}} : null;
    }
}

export function hasUppercase(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        return control.value && !/^(?=.*[A-Z])/.test(control.value) ? {hasUppercase: {}} : null;
    }
}

export function hasLowercase(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        return control.value && !/^(?=.*[a-z])/.test(control.value) ? {hasLowercase: {}} : null;
    }
}

export function hasNumber(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        return control.value && !/^(?=.*[0-9])/.test(control.value) ? {hasNumber: {}} : null;
    }
}

export function hasSpecial(specials: string = '!@#$%&*'): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const regexp = new RegExp(`^(?=.*[${specials}])`);
        return control.value && !regexp.test(control.value) ? {hasSpecial: {needed: specials}} : null;
    }
}

export function strongPassword(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const fullValidation = {
            ...hasLowercase()(control),
            ...hasUppercase()(control),
            ...hasNumber()(control),
            ...hasSpecial()(control),
            ...Validators.minLength(8)(control),
        }
        return Object.keys(fullValidation).length ? fullValidation : null;
    }
}