import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeaderTableSearchComponent } from './header-table-search.component';

describe('HeaderTableSearchComponent', () => {
  let component: HeaderTableSearchComponent;
  let fixture: ComponentFixture<HeaderTableSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderTableSearchComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeaderTableSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
