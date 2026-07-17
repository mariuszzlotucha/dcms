import 'reflect-metadata';

const ENCRYPTED_FIELDS = Symbol('ENCRYPTED_FIELDS');

/**
 * Marks an entity property as containing sensitive data that should be
 * encrypted at rest. Consumed by FieldEncryptionService.encryptFields /
 * decryptFields. Storage-agnostic on purpose — once TypeORM lands, the
 * same metadata can drive an entity subscriber / value transformer.
 */
export function EncryptedField(): PropertyDecorator {
  return (target, propertyKey) => {
    const ctor = target.constructor;
    const own: (string | symbol)[] =
      Reflect.getOwnMetadata(ENCRYPTED_FIELDS, ctor) ?? [];
    Reflect.defineMetadata(ENCRYPTED_FIELDS, [...own, propertyKey], ctor);
  };
}

const fieldsCache = new Map<unknown, (string | symbol)[]>();

/**
 * Returns encrypted field names for an instance, including fields
 * inherited from parent classes. Cached per constructor — this runs on
 * every encrypt/decryptFields call, so walking the prototype chain each
 * time would be wasted work on hot DB paths.
 */
export function getEncryptedFields(instance: object): (string | symbol)[] {
  const rootCtor = instance.constructor;
  const cached = fieldsCache.get(rootCtor);
  if (cached) return cached;

  const fields = new Set<string | symbol>();
  let ctor: unknown = rootCtor;

  while (typeof ctor === 'function' && ctor !== Function.prototype) {
    const own: (string | symbol)[] =
      Reflect.getOwnMetadata(ENCRYPTED_FIELDS, ctor) ?? [];
    own.forEach((f) => fields.add(f));
    ctor = Object.getPrototypeOf(ctor);
  }

  const result = [...fields];
  fieldsCache.set(rootCtor, result);
  return result;
}
