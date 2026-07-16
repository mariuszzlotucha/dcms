import 'reflect-metadata';

const ENCRYPTED_FIELDS = Symbol('ENCRYPTED_FIELDS');

export function EncryptedField(): PropertyDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;
    const own: (string | symbol)[] =
      Reflect.getOwnMetadata(ENCRYPTED_FIELDS, ctor) ?? [];
    Reflect.defineMetadata(ENCRYPTED_FIELDS, [...own, propertyKey], ctor);
  };
}

export function getEncryptedFields(instance: object): (string | symbol)[] {
  const fields = new Set<string | symbol>();
  let ctor: unknown = instance.constructor;

  while (typeof ctor === 'function' && ctor !== Function.prototype) {
    const own: (string | symbol)[] =
      Reflect.getOwnMetadata(ENCRYPTED_FIELDS, ctor) ?? [];
    own.forEach((f) => fields.add(f));
    ctor = Object.getPrototypeOf(ctor);
  }

  return [...fields];
}
