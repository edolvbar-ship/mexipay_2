import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
    selector: 'input-select',
    imports: [CommonModule],
    templateUrl: './input-select.component.html',
    styleUrl: './input-select.component.css',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => InputSelectComponent),
            multi: true,
        },
    ]
})
export class InputSelectComponent {

  @Input() variant: 'primary' | 'secondary' = 'primary';
  @Input() label: string = ''
  @Input() id: string = '';
  @Input() required: boolean = false;
  @Input() src: string = '';
  @Input() secondarySrc: string = '';
  @Input() options: { id: number; option: string }[] = [];
  @Input() control: string = '';
  @Input() isRequired: boolean = false;
  @Input() hasError: boolean = false;
  @Input() dynamicSelectedOption: string | number = 0;

  value: string = '';
  isTouched: boolean = false;
  isValid: boolean = true;


  onChange = (value: string) => {};
  onTouched = () => {};

  ngOnInit(): void {}

  writeValue(value: string): void {
    this.value = value;
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {

  }

  // Método para manejar cambios en el select
  handleChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.value = value;
    this.onChange(value);
    this.onTouched();
    this.isTouched = true;
    this.isValid = !this.isRequired || !!value;
  }

}
