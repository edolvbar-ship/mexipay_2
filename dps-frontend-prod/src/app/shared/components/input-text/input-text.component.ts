import { Component, forwardRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common'
import { InputTextModule } from 'primeng/inputtext';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';


@Component({
    selector: 'input-text',
    imports: [CommonModule, InputTextModule, FormsModule],
    templateUrl: './input-text.component.html',
    styleUrl: './input-text.component.css',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => InputTextComponent),
            multi: true
        }
    ]
})
export class InputTextComponent implements ControlValueAccessor{

  @Input() variant: 'primary' | 'secondary' = 'primary';
  @Input() label: string = ''
  @Input() type: string = 'text';
  @Input() id: string = '';  @Input() placeholder: string = '';
  @Input() maxlength: number | null = 25;
  //@Input() disabled: boolean = false;
  @Input() error: string | null = null;

  @Input() hasError: boolean = false;
  @Input() src: string = '';
  @Input() secondarySrc: string = '';
  @Input() formControlName: string = '';
  @Input() isRequired: boolean = false
  @Input() isUpperCase: boolean = false
  @Input() isNumericCase: boolean = false
  @Input() initialValue: string | null = null

  @Input() typeValue: string = 'text'

  inputValue: string = '';

isDisabled: boolean = false;
  private _value: string = '';

  hasPlaceholder(): boolean{
    if(this.placeholder) {
      return true
    } else {
      return false
    }
  }

get value(): string {
  return this._value;
}

set value(val: string) {
  this._value = this.sanitizeInput(val);
}


private sanitizeInput(input: string): any {
if (typeof input === 'string') {
      return input.replace(/[^a-zA-Z0-9@.,\s/:]/g, '');
  }
}

validateEmail(email: string): boolean {
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailPattern.test(email);
}


private validateInput(input: string): boolean {
  const regex = /^[a-zA-Z0-9]*$/;
  return regex.test(input);
}

  // Métodos requeridos por ControlValueAccessor
  onChange: any = () => {};
  onTouched: any = () => {};

  placeholderError(Id: string): string {
    if(this.error)
    {
      return this.error
    } else return `${Id} es requerido...`
  }


  onInput(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    let inputValue = inputElement.value;

    if (this.isNumericCase) {
      inputValue = inputValue.replace(/[^0-9]/g, '');
    }

    if (this.isUpperCase) {
      inputValue = inputValue.toUpperCase();
    }

    inputElement.value = inputValue;
    this.value = inputValue;
    this.onChange(this.value);
  }

  writeValue(value: any): void {
    let newValue = value || this.initialValue || '';
    if (this.isNumericCase) {
      newValue = newValue.toString().replace(/[^0-9]/g, '');
    }
    if (this.isUpperCase) {
      newValue = newValue.toUpperCase();
    }
    this.value = newValue;
  }

  // Método para manejar cuando el campo pierde el foco (blur)
  onBlur(): void {
    if (this.isNumericCase) {
      this.value = this.value.replace(/[^0-9]/g, '');  // Filtra caracteres no numéricos
    }
    this.onTouched(); // Marca el campo como "tocado"
    this.onChange(this.value);
  }

  registerOnChange(fn: any): void {
    this.onChange = fn; // Registra la función de cambio
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn; // Registra la función de toque
  }

  setDisabledState?(isDisabled: boolean): void {
    this.isDisabled = isDisabled; // Habilita o deshabilita el input
  }



  isEmailValid(): boolean {
    const input = this.value
      if(this.value === '') {
        return true
      } else if(!this.validateEmail(input)) {
        this.hasError = true
        this.isRequired = true
        this.value =''
        return false
      } else {
        this.hasError = false
        return true
  }}


}
