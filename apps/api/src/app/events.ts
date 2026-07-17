import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../platform/events';
import { DOMAIN_EVENTS, DomainEventPayloadMap } from '../domain/events';

// Compile-time guard: the spread merge below would silently let a domain
// event shadow a platform event with the same name. If the two maps ever
// share a key, _NoOverlap resolves to `never` and this file stops
// compiling — fix by renaming the colliding event, not by removing this.
type _NoOverlap = Extract<
  keyof PlatformEventPayloadMap,
  keyof DomainEventPayloadMap
> extends never
  ? true
  : never;
const _check: _NoOverlap = true;
void _check;

export const EVENTS = {
  ...PLATFORM_EVENTS,
  ...DOMAIN_EVENTS,
} as const;

export type EventPayloadMap = PlatformEventPayloadMap & DomainEventPayloadMap;
