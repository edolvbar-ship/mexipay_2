import { Component, Input, input } from '@angular/core';
import { SearchBarComponent } from '../search-bar/search-bar.component';

@Component({
    selector: 'header-table-search',
    imports: [SearchBarComponent],
    templateUrl: './header-table-search.component.html',
    styleUrl: './header-table-search.component.css'
})
export class HeaderTableSearchComponent {

  @Input() dataService: any[] = [];
}
