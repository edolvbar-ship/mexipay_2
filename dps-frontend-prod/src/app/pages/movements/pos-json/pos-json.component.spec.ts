import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PosJsonComponent } from './pos-json.component';

describe('PosJsonComponent', () => {
  let component: PosJsonComponent;
  let fixture: ComponentFixture<PosJsonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PosJsonComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PosJsonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
