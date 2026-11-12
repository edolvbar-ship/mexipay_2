import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'paginator',
  standalone: true
})
export class PaginatorPipe implements PipeTransform {

  transform(data: any[], first: number, rows: number): any[] {

    if (!data || !Array.isArray(data)) {
      return [];
    }
    return data.slice(first, first + rows);
  }

}
