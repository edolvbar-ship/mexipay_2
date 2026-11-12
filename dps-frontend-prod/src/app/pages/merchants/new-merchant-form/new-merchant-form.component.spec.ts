import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewMerchantFormComponent } from './new-merchant-form.component';

describe('NewMerchantFormComponent', () => {
  let component: NewMerchantFormComponent;
  let fixture: ComponentFixture<NewMerchantFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewMerchantFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewMerchantFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
