import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
    selector: 'input-radial',
    imports: [],
    templateUrl: './input-radial.component.html',
    styleUrls: ['./input-radial.component.css'],
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: InputRadialComponent,
            multi: true,
        },
    ]
})
export class InputRadialComponent {
  
  @Input() text: string = '';
  @Input() id: string = 'radial-input';
  @Input() formControlName: string = '';
  @Output() toggleChange = new EventEmitter<boolean>();
  
  private _value: boolean = false;
  onChange: (value: boolean) => void = () => {};
  onTouched: () => void = () => {};

  get value(): boolean {
    return this._value;
  }

  set value(val: boolean) {
    this._value = val;
    this.onChange(val);
    this.onTouched();
    this.toggleChange.emit(val);
  }

  writeValue(value: boolean): void {
    this.value = value;
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  toggleValue(): void {
    this.value = !this.value; 
  }
}
