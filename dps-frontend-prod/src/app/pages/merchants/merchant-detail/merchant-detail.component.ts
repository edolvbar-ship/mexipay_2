import { Component, OnDestroy, OnInit } from '@angular/core';
import { SectionTitleComponent } from "../../../shared/components/section-title/section-title.component";
import { PageDetailComponent } from "../../../shared/components/page-detail/page-detail.component";
import { MsiConfigComponent } from "../../../components/msi-config/msi-config.component";
import { ActivatedRoute } from '@angular/router';
import { MerchantsService } from '@/app/services/merchants/merchants.service';
import { DataMaskerService } from '@/app/services/shared/data-masker/data-masker.service';
import { TransactionProfilesService } from '@/app/services/catalogues/transaction-profiles/transaction-profiles.service';
import { MccOperationsService, MccOperation } from '@/app/services/catalogues/mcc-operations/mcc-operations.service';
import { CommonModule } from '@angular/common';
import { map, Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-merchant-detail',
    imports: [SectionTitleComponent, PageDetailComponent, MsiConfigComponent, CommonModule],
    templateUrl: './merchant-detail.component.html',
    styleUrl: './merchant-detail.component.css'
})
export default class MerchantDetailComponent implements OnInit, OnDestroy{
  constructor(
    private route : ActivatedRoute,
    private merchantService: MerchantsService,
    private transactionProfilesService: TransactionProfilesService,
    private mccOperationsService: MccOperationsService,
    private dataMaskerService: DataMaskerService ) {}

    linkText: string[] = ['/comercios'];
    infoMerchant: any = {};
    idMerchant : number | null = null;

    // Additional info
    profileCatalogs: any = null;
    selectedProfileOperations: any = null;
    mccOperations: MccOperation[] = [];

    private destroy$ = new Subject<void>();

  ngOnInit(): void {

    const id = this.route.snapshot.paramMap.get('id') || '';
    this.idMerchant = parseInt(id);

    this.merchantService.getMerchantById(this.idMerchant).pipe(
      map(response => {
        const client = this.dataMaskerService.applyMasks(response)
        this.getDataMerchant(client)
        this.loadAdditionalInfo(client)
      }),
      takeUntil(this.destroy$)
    ).subscribe()
  }

  loadAdditionalInfo(data: any) {
    // Load catalogs for profiling
    this.transactionProfilesService.getCatalogs().subscribe(catalogs => {
      this.profileCatalogs = catalogs;
      if (data.id_perfil_transaccional) {
        this.fetchAndDecodeProfile(data.id_perfil_transaccional);
      }
    });

    // Load MCC operations
    if (data.mcc) {
      this.mccOperationsService.getOperationsByMccCode(data.mcc).subscribe((ops: any[]) => {
        this.mccOperations = ops;
      });
    }
  }

  fetchAndDecodeProfile(profileId: any) {
    this.transactionProfilesService.getAllData().subscribe(profiles => {
      const profile = profiles.find((p: any) => p.id == profileId);
      if (profile && profile.decoded && this.profileCatalogs) {
        const decoded = profile.decoded;
        const result: any = {
          aplicacion: '',
          trans: [],
          indicadores: []
        };

        const app = this.profileCatalogs.aplicationsOperatives.find((a: any) => a.id_operative == decoded.aplicacion);
        result.aplicacion = app ? app.name : 'Unknown';

        decoded.trans.forEach((tId: any) => {
          const trans = this.profileCatalogs.transactionsType.find((t: any) => t.id_trantype == tId);
          if (trans) result.trans.push(trans.name);
        });

        decoded.indicadores.forEach((iId: any) => {
          const indicator = this.profileCatalogs.indicators.find((i: any) => i.id_tranindicator == iId);
          if (indicator) result.indicadores.push(indicator.name);
        });

        this.selectedProfileOperations = result;
      }
    });
  }

  getDataMerchant(data: any) {

    this.infoMerchant = {
      Estatus: data.active === 1 ? 'Activo' : 'Inactivo',
      MMC: `${data.mcc} - ${data.mcc_desc}`,
      'Agente Comercial': data.agente_comercial,
      'Contacto Comercio': data.contact_merchant,
      Celular: data.mobile_contact,
      'Teléfono Principal': data.tel1_contact,
      'Correo Electrónico': data.email_contact,
      'Token de Activación': data.token_activation,
      'Fecha de Creación': data.creation_date,
      'Última Actualización': data.last_update,
      'Tasa Crédito': data.t_credito,
      'Tasa Débito': data.t_debito,
      'Tasa Internacional': data.t_amex,
      'Rol del Contacto': data.rol_contact,
      Terminales: ''
    }
  }

  ngOnDestroy(): void {

    this.destroy$.next();
    this.destroy$.complete();

  }

}
