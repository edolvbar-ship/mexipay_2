import { TestBed } from '@angular/core/testing';

import { TargetUrlsService } from './target-urls.service';

describe('TargetUrlsService', () => {
  let service: TargetUrlsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TargetUrlsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
