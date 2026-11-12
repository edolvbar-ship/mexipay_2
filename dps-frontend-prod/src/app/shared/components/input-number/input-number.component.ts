import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input  } from '@angular/core';
import { ControlValueAccessor, FormControl, FormGroup, FormsModule, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';

@Component({
    selector: 'input-number',
    imports: [InputNumberModule, CommonModule, FormsModule, ReactiveFormsModule],
    templateUrl: './input-number.component.html',
    styleUrl: './input-number.component.css',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => InputNumberComponent),
            multi: true
        }
    ]
})
export class InputNumberComponent implements ControlValueAccessor {

  @Input() variant: 'primary' | 'secondary' = 'primary';
  //@Input() formControlName: string = '';
  @Input() label: string = '';
  @Input() type: string = 'number';
  @Input() id: string = '';
  @Input() placeholder: string = '';
  @Input() required: boolean = false;
  @Input() inputId: string = 'withoutgrouping'
  @Input() value1!: number;



  value: string = '';
  isDisabled: boolean = false;

  // Métodos requeridos por ControlValueAccessor
  onChange: any = () => {};
  onTouched: any = () => {};

  onInput(event: Event) {
    const input = event.target as HTMLInputElement; // Asegúrate de que sea un HTMLInputElement
    this.value = input.value; // Obtén el valor del input
    this.onChange(input.value); // Propaga el cambio al formulario
}

  writeValue(value: any): void {
    this.value = value || ''; // Inicializa el valor
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

  // Método para manejar cuando el campo pierde el foco (blur)
  onBlur(): void {
    this.onTouched(); // Marca el campo como "tocado"
  }
}


