import { Component, Input } from '@angular/core';
import { TextTypeComponent } from '../text-type/text-type.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PrimeIcons } from 'primeng/api'

@Component({
    selector: 'action-button',
    imports: [TextTypeComponent, CommonModule, RouterLink],
    templateUrl: './action-button.component.html',
    styleUrl: './action-button.component.css'
})
export class ActionButtonComponent {
  @Input() linkIcon: string = '';
  @Input() text: string = 'Enviar';
  @Input() altText: string = ''; 
  @Input() variant: 'primary' | 'secondary' = 'primary';
  @Input() linkText: string[] = [];
  @Input() isActive: boolean = false;

  
  get iconName(): string {
    const formattedIcon = this.linkIcon.toUpperCase().replace(' ', '_'); 
    return (PrimeIcons[formattedIcon as keyof typeof PrimeIcons] || 'pi pi-plus-circle') as string;
  }
  
}
