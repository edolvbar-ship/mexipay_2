import { Component, Input } from '@angular/core';
import { TextTitleComponent } from '../text-title/text-title.component';
import { TextTypeComponent } from '../text-type/text-type.component';
import { ActionButtonComponent } from '../action-button/action-button.component';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { PrimeIcons } from 'primeng/api';

@Component({
    selector: 'section-title',
    imports: [TextTitleComponent, TextTypeComponent, ActionButtonComponent, CommonModule, RouterOutlet],
    templateUrl: './section-title.component.html',
    styleUrl: './section-title.component.css'
})
export class SectionTitleComponent {

  @Input() title: string = '';
  @Input() subHead: string = '';
  @Input() textBtn: string = '';
  @Input() linkText: string[] = [];
  @Input() canCreate: boolean = false;
  @Input() icon: string = 'PLUS_CIRCLE';

}
