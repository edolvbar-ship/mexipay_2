import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewPaymentLinkComponent } from './new-payment-link.component';

describe('NewPaymentLinkComponent', () => {
  let component: NewPaymentLinkComponent;
  let fixture: ComponentFixture<NewPaymentLinkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewPaymentLinkComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewPaymentLinkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
