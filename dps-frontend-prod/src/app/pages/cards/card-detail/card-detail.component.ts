import { Component, OnDestroy, OnInit } from '@angular/core';
import { PageDetailComponent } from "../../../shared/components/page-detail/page-detail.component";
import { SectionTitleComponent } from "../../../shared/components/section-title/section-title.component";
import { ActivatedRoute } from '@angular/router';
import { BinesService } from '@/app/services/bines/bines.service';
import { map, Subject, takeUntil } from 'rxjs';
import { DataMaskerService } from '@/app/services/shared/data-masker/data-masker.service';

@Component({
    selector: 'app-card-detail',
    imports: [PageDetailComponent, SectionTitleComponent],
    templateUrl: './card-detail.component.html',
    styleUrl: './card-detail.component.css'
})
export class CardDetailComponent implements OnInit, OnDestroy {

  constructor(
    private route: ActivatedRoute,
    private cardsService: BinesService,
    private dataMaskerService: DataMaskerService
  ) { }

  linkText: string[] = ['/tarjetas'];
  infoCard: any;
  idCard: string | null = null

  private destroy$ = new Subject<void>();

  ngOnInit(): void {

    this.idCard = this.route.snapshot.paramMap.get('id');

    if (this.idCard) {
      this.cardsService.getDataById(this.idCard).pipe(
        map(response => {
          const card = this.dataMaskerService.applyMasks(response.data[0])
          this.getDataCard(card)
        }),
        takeUntil(this.destroy$)
      ).subscribe()
    }
  }

  getDataCard(data: any) {

    this.infoCard = {
      'Bin': data.bin,
      'Banco': data.bank,
      'Producto': data.product,
      'Tipo': data.type,
      'Procesador': data.processor_name ? data.processor_name : 'Definido por el comercio',
      'Marca': data.brand,
      '3DS': data["3DS"] ? 'Sí' : 'No',
      'Fecha Creación': data.creation_date,
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
