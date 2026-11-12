import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { fromEvent } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { SearchService } from '@/app/services/shared/search/search.service';

@Component({
  selector: 'search-bar',
  standalone: true,
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.css']
})
export class SearchBarComponent implements  AfterViewInit, OnChanges {

  @Input() dataService: any[] = [];
  private originalData: any[] = [];

  @ViewChild('inputSearch', { static: true }) inputSearch?: ElementRef;

  constructor(private searchService: SearchService) {}

  

  ngAfterViewInit(): void {
    fromEvent<any>(this.inputSearch?.nativeElement, 'keyup')
      .pipe(
        map(event => event.target.value),
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe((search: string) => {
        this.searchService.emitText(search, this.originalData);
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dataService'] && changes['dataService'].currentValue) {
      if (this.originalData.length === 0) {
        this.originalData = [...this.dataService];
      }
    }
  }

  preventEvent(event: KeyboardEvent): void {
    if (event.code === 'Enter') {
      event.preventDefault();
    }
  }
}
