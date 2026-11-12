import { Component, OnDestroy, OnInit } from '@angular/core';
import { SectionTitleComponent } from "../../../shared/components/section-title/section-title.component";
import { PageDetailComponent } from "../../../shared/components/page-detail/page-detail.component";
import { ActivatedRoute } from '@angular/router';
import { ClientsService } from '@/app/services/clients/clients.service';
import { map, Subject, takeUntil } from 'rxjs';
import { DataMaskerService } from '@/app/services/shared/data-masker/data-masker.service';

@Component({
    selector: 'app-clients-detail',
    imports: [SectionTitleComponent, PageDetailComponent],
    templateUrl: './clients-detail.component.html',
    styleUrl: './clients-detail.component.css'
})
export default class ClientsDetailComponent implements OnInit, OnDestroy{

  constructor(
    private route : ActivatedRoute,
    private clientsService: ClientsService,
    private dataMaskerService: DataMaskerService
  ) {}

  linkText: string[] = ['/clientes'];
  infoClient: any = {};
  idClient : number | null = null

  private destroy$ = new Subject<void>();

  ngOnInit(): void {

    const id = this.route.snapshot.paramMap.get('id') || '';
    this.idClient = parseInt(id);
    
    this.clientsService.getClientById(this.idClient).pipe(
      map(response => {
        const client = this.dataMaskerService.applyMasks(response.data)
        this.getDataClient(client)
      }),
      takeUntil(this.destroy$)
    ).subscribe()
  }

  getDataClient(data: any) {

    this.infoClient = {
      'Nombre Cliente': data.name,
      'Razon Social': data.razon_social,	
      'Representante Legal': data.representative,	
      'RFC': data.rfc,	
      'Página Web': data.url,	
      'Descripción': data.description,	
      'Agente': data.agente,	
      'Contacto de Cliente': data.contact_cliente,	
      'Rol de Contacto': data.rol_contact,
      'Celular': data.mobile_contact,
      'Teléfono Principal': data.tel1_contact,
      'Fecha de Creación': data.creation_date,
      'Última Actualización': data.last_update,
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

}
