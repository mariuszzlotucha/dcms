import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Roles } from './roles.decorator';

describe('Roles decorator', () => {
  it('sets the given roles as metadata under ROLES_KEY', () => {
    class Test {
      @Roles('owner', 'admin')
      handler() {}
    }

    const reflector = new Reflector();
    expect(reflector.get(ROLES_KEY, new Test().handler)).toEqual(['owner', 'admin']);
  });

  it('sets an empty array when called with no roles', () => {
    class Test {
      @Roles()
      handler() {}
    }

    const reflector = new Reflector();
    expect(reflector.get(ROLES_KEY, new Test().handler)).toEqual([]);
  });
});
