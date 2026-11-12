import { TestBed } from '@angular/core/testing';

import { UrlTargetService } from './url-target.service';

describe('LogicalNetworksService', () => {
  let service: UrlTargetService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UrlTargetService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
