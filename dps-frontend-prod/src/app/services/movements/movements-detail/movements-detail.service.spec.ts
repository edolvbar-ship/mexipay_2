import { TestBed } from '@angular/core/testing';

import { MovementsDetailService } from './movements-detail.service';

describe('MovementsDetailService', () => {
  let service: MovementsDetailService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MovementsDetailService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
