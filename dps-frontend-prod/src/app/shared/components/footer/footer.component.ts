import { Component, Input, OnInit } from '@angular/core';
import { TextTypeComponent } from '../text-type/text-type.component';
import { utils } from '@/app/utils/utils';
import { AboutService } from '@/app/services/about/about.service';
import { lastValueFrom } from 'rxjs';

@Component({
    selector: 'app-footer',
    imports: [TextTypeComponent],
    templateUrl: './footer.component.html',
    styleUrl: './footer.component.css'
})
export class FooterComponent implements OnInit{

  @Input() text: string;

  constructor(private aboutService: AboutService){
    this.text = `Mexipay, Versión Web ${utils.appVersion} - Versión API 0.0.0`;
  }

  async ngOnInit(): Promise<void> {
    const appVersion = (await lastValueFrom(this.aboutService.getInfo())).version;
    this.text = `Mexipay, Versión Web ${utils.appVersion} - Versión API ${appVersion}`;
  }


}
