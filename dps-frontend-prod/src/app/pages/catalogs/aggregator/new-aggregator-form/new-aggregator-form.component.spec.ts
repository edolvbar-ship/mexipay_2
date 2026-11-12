import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewAggregatorFormComponent } from './new-aggregator-form.component';

describe('NewAggregatorFormComponent', () => {
  let component: NewAggregatorFormComponent;
  let fixture: ComponentFixture<NewAggregatorFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewAggregatorFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewAggregatorFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
