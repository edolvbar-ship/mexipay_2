import { TestBed } from '@angular/core/testing';

import { AuthMeService } from './auth-me.service';

describe('AuthMeService', () => {
  let service: AuthMeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthMeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
