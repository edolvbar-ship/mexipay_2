import { TicketsService } from '@/app/services/movements/tickets/tickets.service';
import { SearchService } from '@/app/services/shared/search/search.service';
import { CalendarComponent } from '@/app/shared/components/calendar/calendar.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TableLayoutComponent } from '@/app/shared/components/table-layout/table-layout.component';
import { ShowDataTicket, TicketsDataInterface } from '@/app/shared/interfaces/movements/tickets.interface';
import { CustomTableAction, DateRange } from '@/app/shared/interfaces/types-interface';
import { formatDateRangeToISO } from '@/app/utils/transformedData';
import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { PrimeIcons } from 'primeng/api';
import { firstValueFrom } from 'rxjs';

@Component({
    selector: 'app-tickets',
    imports: [CardContainerComponent, TableLayoutComponent, CalendarComponent, SectionTitleComponent],
    templateUrl: './tickets.component.html',
    styleUrl: './tickets.component.css'
})
export default  class TicketsComponent implements OnInit {

  tickets: ShowDataTicket[] =[];
  initialDates: Date[] = [];
  search: string = '';

  customActions: CustomTableAction<ShowDataTicket>[] = [
    {
      icon: PrimeIcons.DOWNLOAD,
      handler: async (index, item) => {

        //TODO: Rise loading component
        try {

          const pdfData = await firstValueFrom(this.ticketService.getTicketPdfWhitBlob(item));
          const link = document.createElement('a');
          const downloadUrl = window.URL.createObjectURL(pdfData.blob!);
          link.href = downloadUrl;
          link.download = pdfData.data;
          link.click();
          window.URL.revokeObjectURL(downloadUrl);
        } catch(error) {
            this.toastService.error('No fue posible descargar el archivo.')
        }
      }
    }
  ];

  constructor(
    private ticketService: TicketsService, 
    private toastService: ToastrService,
    private searchService: SearchService
  ) {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    this.initialDates = [sevenDaysAgo, today];
  }

  ngOnInit(): void {
    this.searchService.textObservable.subscribe(response => this.sendSearch(response))
  }


  handleDates(event: DateRange){
    const date = formatDateRangeToISO(event)
    this.getElements(date);
  }


  getElements(date: string) {
    this.ticketService.getTicketsSummary(date).subscribe( (data) => {
      this.tickets = data;
    } );
  }

  sendSearch(search: string): void {
    this.search = search;
    if(search !== '') {
      this.ticketService.getDataSearched(this.search).subscribe(filteredData => {
        this.tickets = filteredData;
      });
    } else {
      this.tickets = this.ticketService.tickets
    }
  }

}
