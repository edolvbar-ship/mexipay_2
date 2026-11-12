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
 import { ProcessorsService } from '@/app/services/catalogues/processors/processors.service';
import { FormTrimService } from '@/app/services/shared/form-trim/form-trim.service';

@Component({
    selector: 'app-new-processors-form',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        ActionButtonComponent,
        InputTextComponent,
        TextTitleComponent,
        ReactiveFormsModule
    ],
    templateUrl: './new-processors-form.component.html',
    styleUrl: './new-processors-form.component.css'
})
export default class NewProcessorsFormComponent implements OnInit{

  linkText: string[] = ['/catalogos','procesadores']
  valueChanged: boolean = false;
  isRequiredInvalid: boolean = false;
  formGroup: FormGroup;

  sectionTitle = "Nuevo Procesador";

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastSrv: ToastrService,
    private processorsService: ProcessorsService,
    private formTrimService: FormTrimService
  ) {

    this.formGroup = this.formBuilder.group({
      id: [ 0, Validators.required],
      fiid: ['', Validators.required],
      name: ['', Validators.required]
    });

  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.sectionTitle = "Edición Procesador";
        this.loadData(id);
      }
    });
  }

  loadData(id:string){
    this.processorsService.getDataById(id).subscribe({
      next: (data) => {
        this.formGroup.patchValue({
          id: data.id_processor,
          fiid: data.fiid,
          name: data.name,
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

      this.formTrimService.trimFormValues(this.formGroup);
      const id    = this.formGroup.get('id')?.value;
      const fiid  = this.formGroup.get('fiid')?.value;
      const name  = this.formGroup.get('name')?.value;

      if(id != 0){
        this.processorsService.updateData({ id, fiid, name }).subscribe({
          next: (response) => {
            this.toastSrv.success('Procesador actualizado correctamente.');
            this.router.navigate(this.linkText);
          },
          error: (error) => {
            console.error('Error al guardar los datos', error);
            this.toastSrv.error('Un error ha ocurrido, no se ha podido actualizar de la información.');
          }
        });
      }else{
        this.processorsService.saveData({ fiid, name }).subscribe({
          next: (response) => {
            this.toastSrv.success('Procesador guardado correctamente.');
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
