import { ErrorMessageService } from '@/app/services/shared/error-message/error-message.service';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Optional, Output, Self } from '@angular/core';
import { AbstractControl, ControlValueAccessor, FormsModule, NgControl, Validators } from '@angular/forms';

@Component({
    selector: 'app-input-switch',
    imports: [FormsModule, CommonModule],
    templateUrl: './input-switch.component.html',
    styleUrl: './input-switch.component.css'
})
export class ToggleSwitchComponent implements ControlValueAccessor, OnInit{


  control!: AbstractControl | null;
  selectedValue: string | boolean = true;

  @Input() required: string | boolean = false;
  @Input() type: 'radio' | 'checkbox' = 'checkbox';
  @Input() name: string;
  @Input() value: string | boolean = true
  @Input() disabled: string | boolean = false;
  @Input() label: string = '';
  @Input() labelOn: 'left' | 'right' = 'left';
  @Input('plain') showPlain:string | boolean = false;
  @Input() variant: 'primary' | 'secondary' = 'primary';
  @Input() size: 'xs'|'sm'|'md'|'lg'|'xl' = 'md'


  constructor(@Optional() @Self() private ngControl: NgControl, private errorMsgService: ErrorMessageService){
    if(this.ngControl)
    this.ngControl.valueAccessor = this;
    this.name =`input-${Math.random()}${Math.random()}${Math.random()}`

}

ngOnInit(): void {
  this.control = this.ngControl?.control;
  this.required = (this.required || this.required === '') || (this.control?.hasValidator(Validators.requiredTrue) || false);
  this.showPlain = this.showPlain || this.showPlain === '';
}

onInput(event: Event) {
  const input = event.target as HTMLInputElement;
  this.selectedValue = this.type == 'checkbox' ? input.checked : input.value;
  this.onChange(this.selectedValue);
  this.onTouched();
  if(this.required && !this.selectedValue){
    this.control?.setErrors({"required": true})
  }
}

get checked(){
  return this.selectedValue == this.value
}

onChange = (value: any) => {};
onTouched = () => {};

writeValue(value: any): void {
  this.selectedValue = value;
}
registerOnChange(fn: any): void {
  this.onChange = fn;
}
registerOnTouched(fn: any): void {
  this.onTouched = fn;
}
setDisabledState?(isDisabled: boolean): void {
  this.disabled = isDisabled;
}

isInvalid(): boolean {
  return ((this.control?.invalid && (this.control.touched || this.control.dirty) ) || false)
}

getError(control: AbstractControl | null): string {
  return this.errorMsgService.getErrorMessage(control) || '&nbsp;';
}

}
