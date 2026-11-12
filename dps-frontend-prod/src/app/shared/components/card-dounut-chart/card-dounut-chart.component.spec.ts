import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CardDounutChartComponent } from './card-dounut-chart.component';

describe('CardDounutChartComponent', () => {
  let component: CardDounutChartComponent;
  let fixture: ComponentFixture<CardDounutChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardDounutChartComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CardDounutChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
