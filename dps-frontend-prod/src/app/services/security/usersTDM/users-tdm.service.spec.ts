import { TestBed } from '@angular/core/testing';

import { UsersTDMService } from './users-tdm.service';

describe('UsersTDMService', () => {
  let service: UsersTDMService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(UsersTDMService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
