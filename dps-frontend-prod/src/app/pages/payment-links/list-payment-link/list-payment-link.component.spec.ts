import { ComponentFixture, TestBed } from '@angular/core/testing';
import ListPaymentLinkComponent from './list-payment-link.component';


describe('ListPaymentLinkComponent', () => {
  let component: ListPaymentLinkComponent;
  let fixture: ComponentFixture<ListPaymentLinkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListPaymentLinkComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ListPaymentLinkComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
