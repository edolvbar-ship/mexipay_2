import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private textSearch: BehaviorSubject<string>;
  private filteredData: BehaviorSubject<any[]>; 
  private inputData: BehaviorSubject<any[]>;
  textObservable: Observable<string>;
  DataObservable: Observable<any[]>;

  constructor() { 
    this.textSearch = new BehaviorSubject<string>('');
    this.textObservable = this.textSearch.asObservable();

    this.filteredData = new BehaviorSubject<any[]>([]);
    this.DataObservable = this.filteredData.asObservable();

    this.inputData = new BehaviorSubject<any[]>([]);
  }

  emitText(search: string, data: any[]): void {
    if (this.inputData.getValue() !== data) {
      this.inputData.next(data);
      this.filterData(search, data);
    }
    
    if (this.textSearch.getValue() !== search) {
      this.textSearch.next(search); 
    }
  }

  private filterData(search: string, data: any[]): void {
    const searchLower = search.toLowerCase();

    if (searchLower !== '') {
      const filtered = data.filter(merchant => 
        Object.keys(merchant).some(key => {
          const value = merchant[key];
          return value != null && value.toString().toLowerCase().includes(searchLower);
        })
      );

      if (filtered.length === 0) {
        this.filteredData.next([]);
      } else {
        this.filteredData.next(filtered);
      }
    } else {
      this.filteredData.next(data);
    }
  }

  getSearchObservable(): Observable<string> {
    return this.textObservable;
  }

  getFilteredDataObservable(): Observable<any[]> {
    return this.DataObservable;
  }
}
