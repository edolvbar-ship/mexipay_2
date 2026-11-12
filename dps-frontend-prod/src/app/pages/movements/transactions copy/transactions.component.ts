import { ActionButtonComponent } from '@/app/shared/components/action-button/action-button.component';
import { BasicTableComponent } from '@/app/shared/components/basic-table/basic-table.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { HeaderTableSearchComponent } from '@/app/shared/components/header-table-search/header-table-search.component';
import { SearchBarComponent } from '@/app/shared/components/search-bar/search-bar.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TableFooterComponent } from '@/app/shared/components/table-footer/table-footer.component';
import { TextTypeComponent } from '@/app/shared/components/text-type/text-type.component';
import { Component } from '@angular/core';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';

@Component({
    selector: 'app-transactions',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        TextTitleComponent,
        TextTypeComponent,
        SearchBarComponent,
        ActionButtonComponent,
        BasicTableComponent,
        TableFooterComponent,
        HeaderTableSearchComponent
    ],
    templateUrl: './transactions.component.html',
    styleUrl: './transactions.component.css'
})
export default class TransactionsComponent {

}
