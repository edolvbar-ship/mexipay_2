import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { Component } from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';

@Component({
    selector: 'app-security',
    imports: [SectionTitleComponent, CardContainerComponent, InputTextModule],
    templateUrl: './security.component.html',
    styleUrl: './security.component.css'
})
export class SecurityComponent {
  
}
