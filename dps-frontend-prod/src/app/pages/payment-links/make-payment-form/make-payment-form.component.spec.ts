import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MakePaymentFormComponent } from './make-payment-form.component';

describe('MakePaymentFormComponent', () => {
  let component: MakePaymentFormComponent;
  let fixture: ComponentFixture<MakePaymentFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MakePaymentFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MakePaymentFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
