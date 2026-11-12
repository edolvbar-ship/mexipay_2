import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ContrachargesComponent } from './contracharges.component';

describe('ContrachargesComponent', () => {
  let component: ContrachargesComponent;
  let fixture: ComponentFixture<ContrachargesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContrachargesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ContrachargesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
