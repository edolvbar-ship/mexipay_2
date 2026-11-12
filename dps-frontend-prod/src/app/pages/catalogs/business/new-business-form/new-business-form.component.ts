import { ActionButtonComponent } from '@/app/shared/components/action-button/action-button.component';
import { CardContainerComponent } from '@/app/shared/components/card-container/card-container.component';
import { InputTextComponent } from '@/app/shared/components/inputs/input-text/input-text.component';
import { SectionTitleComponent } from '@/app/shared/components/section-title/section-title.component';
import { TextTitleComponent } from '@/app/shared/components/text-title/text-title.component';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
 } from '@angular/forms';

 import { ToastrService } from 'ngx-toastr';
 import { BusinessService } from '@/app/services/catalogues/business/business.service';
import { FormTrimService } from '@/app/services/shared/form-trim/form-trim.service';

@Component({
    selector: 'app-new-business-form',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        ActionButtonComponent,
        InputTextComponent,
        TextTitleComponent,
      
        ReactiveFormsModule
    ],
    templateUrl: './new-business-form.component.html',
    styleUrl: './new-business-form.component.css'
})
export default class NewBusinessFormComponent implements OnInit{

  linkText: string[] = ['/catalogos','giros']
  valueChanged: boolean = false;
  isRequiredInvalid: boolean = false;
  formGroup: FormGroup;

  sectionTitle = "Nuevo Giro (MCC)";

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastSrv: ToastrService,
    private businessService: BusinessService,
    private formTrimService: FormTrimService
  ) {

    this.formGroup = this.formBuilder.group({
      id: [ 0, Validators.required],
      mcc: ['', Validators.required],
      description: ['', Validators.required]
    });

  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.sectionTitle = "Edición Giro (MCC)";
        this.loadData(id);
      }
    });
  }

  loadData(id:string){
    this.businessService.getDataById(id).subscribe({
      next: (data) => {
        this.formGroup.patchValue({
          id: data.id_mcc,
          mcc: data.mcc,
          description: data.description,
        });
      },
      error: (error) => {
        this.toastSrv.error('No se ha encontrado información para este id.');
        this.router.navigate(this.linkText);
      },
    });
  };

  saveForm():void {
    if(!this.formGroup.invalid) {

      this.formTrimService.trimFormValues(this.formGroup)

      const id   = this.formGroup.get('id')?.value;
      const mcc  = this.formGroup.get('mcc')?.value;
      const description = this.formGroup.get('description')?.value;

      if(id != 0){
        this.businessService.updateData({ id, mcc, description, active:true }).subscribe({
          next: (response) => {
            this.toastSrv.success('Giro (MCC) actualizado correctamente.');
            this.router.navigate(this.linkText);
          },
          error: (error) => {
            console.error('Error al guardar los datos', error);
            this.toastSrv.error('Un error ha ocurrido, no se ha podido actualizar de la información.');
          }
        });
      }else{
        this.businessService.saveData({ mcc, description, active:true }).subscribe({
          next: (response) => {
            this.toastSrv.success('Giro (MCC) guardado correctamente.');
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

}
