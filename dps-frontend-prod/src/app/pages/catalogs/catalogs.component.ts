import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { Component } from '@angular/core';

@Component({
    selector: 'app-catalogs',
    imports: [SectionTitleComponent, CardContainerComponent],
    templateUrl: './catalogs.component.html',
    styleUrl: './catalogs.component.css'
})
export default class CatalogsComponent {

}
