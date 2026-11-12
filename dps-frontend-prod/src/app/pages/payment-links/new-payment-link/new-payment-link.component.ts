import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { TextTypeComponent } from '@/app/shared/components/text-type/text-type.component';
import { Component } from '@angular/core';

@Component({
    selector: 'app-new-payment-link',
    imports: [ CardContainerComponent, TextTitleComponent, TextTypeComponent, SectionTitleComponent ],
    templateUrl: './new-payment-link.component.html',
    styleUrl: './new-payment-link.component.css'
})
export class NewPaymentLinkComponent {

}
