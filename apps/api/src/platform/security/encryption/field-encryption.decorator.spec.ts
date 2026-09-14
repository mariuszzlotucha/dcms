import { EncryptedField, getEncryptedFields } from './field-encryption.decorator';

class Base {
  @EncryptedField()
  baseSecret = '';

  plainBaseField = '';
}

class Derived extends Base {
  @EncryptedField()
  derivedSecret = '';

  plainDerivedField = '';
}

class NoDecorators {
  a = 1;
}

describe('EncryptedField / getEncryptedFields', () => {
  it('returns only the decorated field for a class with one', () => {
    expect(getEncryptedFields(new Base())).toEqual(['baseSecret']);
  });

  it('returns an empty array for a class with no decorated fields', () => {
    expect(getEncryptedFields(new NoDecorators())).toEqual([]);
  });

  it('includes fields decorated on parent classes', () => {
    const fields = getEncryptedFields(new Derived());

    expect(fields).toEqual(expect.arrayContaining(['baseSecret', 'derivedSecret']));
    expect(fields).toHaveLength(2);
  });

  it('caches the result per constructor across instances', () => {
    const first = getEncryptedFields(new Derived());
    const second = getEncryptedFields(new Derived());

    expect(second).toBe(first);
  });

  it('does not mix up fields between unrelated classes', () => {
    expect(getEncryptedFields(new Base())).not.toEqual(expect.arrayContaining(['derivedSecret']));
  });
});
