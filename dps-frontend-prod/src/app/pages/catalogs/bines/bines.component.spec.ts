import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BinesComponent } from './bines.component';

describe('BinesComponent', () => {
  let component: BinesComponent;
  let fixture: ComponentFixture<BinesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BinesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BinesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
