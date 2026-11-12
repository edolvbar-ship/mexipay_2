import { ActionButtonComponent } from '@/app/shared/components/action-button/action-button.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { InputTextComponent } from '@/app/shared/components/inputs/input-text/input-text.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
 } from '@angular/forms';

 import { ToastrService } from 'ngx-toastr';

 import { TransactionProfilesService } from '@/app/services/catalogues/transaction-profiles/transaction-profiles.service';
import { catchError, map, mergeMap, Observable, of, tap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormTrimService } from '@/app/services/shared/form-trim/form-trim.service';


@Component({
    selector: 'app-new-transactional-profile-form',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        ActionButtonComponent,
        InputTextComponent,
        TextTitleComponent,
        ReactiveFormsModule,
        CommonModule
    ],
    templateUrl: './new-transactional-profile-form.component.html',
    styleUrl: './new-transactional-profile-form.component.css'
})
export default class NewTransactionalProfileFormComponent implements OnInit{

  linkText: string[] = ['/catalogos','perfil-transaccional']
  valueChanged: boolean = false;
  isRequiredInvalid: boolean = false;
  formGroup: FormGroup;
  idProfile: any = null;

  // catalogs
  aplications:any[]  = [];
  transactions:any[] = [];
  indicators:any[]   = [];

  stringTrans       = '';
  stringOperatives  = '';
  stringIndicators  = '';
  conca             = '';
  hexValue          = '000000';
  appOperativeSelected:any = 0;
  tansTypeSelected:any     = [];
  indicatorsSelected:any  = [];

  sectionTitle = "Nuevo Perfil Transaccional";

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastSrv: ToastrService,
    private transactionProfilesService: TransactionProfilesService,
    private formTrimService: FormTrimService
  ) {

    this.formGroup = this.formBuilder.group({
      id: [ 0, Validators.required],
      name: ['', Validators.required],
      hexValue: ['', Validators.required],
      aplicationRadios: ['', Validators.required],
      transactionsChecks: this.formBuilder.array([]),
      indicatorsChecks: this.formBuilder.array([])
    });

  }

  ngOnInit(): void {

    const id = this.route.snapshot.paramMap.get('id') || undefined
    if(id){
      this.idProfile = id
    }
    this.loadCatalogs().pipe(
      tap(() => this.setStrings()),
      mergeMap(() => this.loadData(this.idProfile))
    ).subscribe({
      error: err => console.error('Error al cargar la data:', err),
    });

  }

  loadCatalogs(): Observable<void> {
    return this.transactionProfilesService.getCatalogs().pipe(
      tap((response) => {
        const { transactionsType, aplicationsOperatives, indicators } = response;
        this.aplications = aplicationsOperatives;
        this.transactions = transactionsType;
        this.indicators = indicators;
        this.addCheckboxesTransactions();
        this.addCheckboxes();
      }),
      map(() => void 0)
    );
  }


  get selectedOptions(): FormArray {
    return this.formGroup.get('indicatorsChecks') as FormArray;
  }


  private addCheckboxesTransactions(): void {

    const transactionsArray = this.formGroup.get('transactionsChecks') as FormArray;
    transactionsArray.clear();

    this.transactions.forEach(() => {
      transactionsArray.push(this.formBuilder.control(false));
    });

  }

  private addCheckboxes(): void {

    const indicatorsArray = this.formGroup.get('indicatorsChecks') as FormArray;
    indicatorsArray.clear();

    this.indicators.forEach(() => {
      indicatorsArray.push(this.formBuilder.control(false));
    });

  }

  isVisbleOption = (hex_val:string) => {
    let response = true;

        if(
            hex_val == '400000' || // Solo AutorizaciÃ³n
            hex_val == '20000'  || // Venta post Propina
            hex_val == '2000'      // No Show
        ){
            response = false
        }

    return response;
}

  loadData(id: string): Observable<any> {
    if (id) {
      return this.transactionProfilesService.getDataById(id).pipe(
        map((data) => {
          this.formGroup.patchValue({
            id: data.data[0].id_profile_transaction,
            hexValue: data.data[0].hex_value,
            name: data.data[0].name,
          });

          const bitMap = data.bitMap;

          this.checkHexa(true, 2, this.aplications[bitMap.aplicacion - 1]["hex_value"]);

          bitMap.trans.map((tra: any) => {
            this.checkHexa(true, 1, this.transactions[tra - 1]["hex_value"]);
          });

          bitMap.indicadores.map((indi: any) => {
            this.checkHexa(true, 3, this.indicators[indi - 1]["hex_value"]);
          });

          this.formGroup.patchValue({
            aplicationRadios: this.appOperativeSelected[0],
          });
        }),
        catchError(() => {
          this.toastSrv.error('No se ha encontrado información para este id.');
          this.router.navigate(this.linkText);
          return of(null);
        })
      );
    } else {
      return of(null);
    }
  }


  isChecked(code:string){
    return  this.tansTypeSelected.includes(code);
  }

  isCheckedIndicator(code:string){
    return  this.indicatorsSelected.includes(code);
  }

  saveForm():void {
    if(!this.formGroup.invalid) {

      this.formTrimService.trimFormValues(this.formGroup);

      const id    = this.formGroup.get('id')?.value;
      const name  = this.formGroup.get('name')?.value;
      const hexValue  = this.formGroup.get('hexValue')?.value;

      if(id != 0){
        this.transactionProfilesService.updateData({ id, hexValue, name }).subscribe({
          next: (response) => {
            this.toastSrv.success('Perfil transaccional actualizado correctamente.');
            this.router.navigate(this.linkText);
          },
          error: (error) => {
            console.error('Error al guardar los datos', error);
            this.toastSrv.error('Un error ha ocurrido, no se ha podido actualizar de la información.');
          }
        });
      }else{
        this.transactionProfilesService.saveData({ hexValue, name }).subscribe({
          next: (response) => {
            this.toastSrv.success('Perfil transaccional guardado correctamente.');
            this.router.navigate(this.linkText);
          },
          error: (error) => {
            console.error('Error al guardar los datos', error);
            this.toastSrv.error('Un error ha ocurrido, no se ha podido guardado de la información.');
          }
        });
      }

    }else{
      this.toastSrv.info('Revisa la información ingresada.');
    }
  }


  setStrings = () =>{
    this.stringTrans        = ('000000' + (0).toString(16)).substr(-6)
    this.stringOperatives   = ('00' + (0).toString(16)).substr(-6)
    this.stringIndicators   = ('000' + (0).toString(16)).substr(-6)
  }

  setConcat = () => this.conca = `${this.stringOperatives}${this.stringTrans}${this.stringIndicators}`;

  checkHexa = (isChecked:any, type:number, hexaValue:string ) =>{

      let dataForach:any = []

      switch(type){
          case 1: // transactions
            (isChecked) ?  this.tansTypeSelected.push(hexaValue) : this.tansTypeSelected.splice( this.tansTypeSelected.indexOf( hexaValue ), 1 );
            dataForach = this.tansTypeSelected
          break;
          case 2: // aplications
            (isChecked) ?  this.appOperativeSelected = [hexaValue] : this.appOperativeSelected.splice( this.appOperativeSelected.indexOf( hexaValue ), 1 );
            dataForach = [this.appOperativeSelected]
          break;
          case 3: // indicators
            (isChecked) ?  this.indicatorsSelected.push(hexaValue) : this.indicatorsSelected.splice( this.indicatorsSelected.indexOf( hexaValue ), 1 );
            dataForach = this.indicatorsSelected
          break;
      }

      var suma = 0;

      dataForach.forEach (function(numero:any){
          suma += parseInt(numero, 16);
      });

      const suma_hex = suma.toString(16).substr(-6);

      switch(type){
          case 2: this.stringOperatives    = suma_hex.padStart(4,'0'); break;
          case 1: this.stringTrans         = suma_hex.padStart(6,'0'); break;
          case 3: this.stringIndicators    = suma_hex.padStart(4,'0'); break;
      }

      this.setConcat();

      this.formGroup.patchValue({
        hexValue : this.conca
      });

      this.hexValue = this.conca;
  }

}

