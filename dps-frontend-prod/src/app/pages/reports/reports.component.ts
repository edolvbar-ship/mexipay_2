import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { Component } from '@angular/core';

@Component({
    selector: 'app-reports',
    imports: [SectionTitleComponent, CardContainerComponent],
    templateUrl: './reports.component.html',
    styleUrl: './reports.component.css'
})
export class ReportsComponent {

}
