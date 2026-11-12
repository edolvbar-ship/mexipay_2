import { TestBed } from '@angular/core/testing';

import { PosjsonService } from './posjson.service';

describe('PosjsonService', () => {
  let service: PosjsonService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PosjsonService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
