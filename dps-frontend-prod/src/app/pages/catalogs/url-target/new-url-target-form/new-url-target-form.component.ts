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

 import { UrlTargetService } from '@/app/services/catalogues/url-target/url-target.service';
import { FormTrimService } from '@/app/services/shared/form-trim/form-trim.service';

@Component({
    selector: 'app-new-url-target-form',
    imports: [
        SectionTitleComponent,
        CardContainerComponent,
        ActionButtonComponent,
        InputTextComponent,
        TextTitleComponent,
        ReactiveFormsModule
    ],
    templateUrl: './new-url-target-form.component.html',
    styleUrl: './new-url-target-form.component.css'
})
export default class NewNetworkFormComponent implements OnInit{

  linkText: string[] = ['/catalogos','url-destino']
  valueChanged: boolean = false;
  isRequiredInvalid: boolean = false;
  formGroup: FormGroup;

  sectionTitle = "Nueva URL Destino";

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastSrv: ToastrService,
    private urlTargetService: UrlTargetService,
    private formTrimService: FormTrimService
  ) {

    this.formGroup = this.formBuilder.group({
      id: [ 0, Validators.required],
      url: ['', Validators.required]
    });

  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.sectionTitle = "Edición URL Destino";
        this.loadData(id);
      }
    });
  }

  loadData(id:string){
    this.urlTargetService.getDataById(id).subscribe({
      next: (data) => {
        this.formGroup.patchValue({
          id: data.id_bnrg_url_dest,
          url: data.url,
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

      const id    = this.formGroup.get('id')?.value;
      const url   = this.formGroup.get('url')?.value;

      if(id != 0){
        this.urlTargetService.updateData({ id, url }).subscribe({
          next: (response) => {
            this.toastSrv.success('URL destino actualizada correctamente.');
            this.router.navigate(this.linkText);
          },
          error: (error) => {
            console.error('Error al guardar los datos', error);
            this.toastSrv.error('Un error ha ocurrido, no se ha podido actualizar de la información.');
          }
        });
      }else{
        this.urlTargetService.saveData({ url }).subscribe({
          next: (response) => {
            this.toastSrv.success('URL destino guardada correctamente.');
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
