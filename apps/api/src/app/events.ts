import { PLATFORM_EVENTS, PlatformEventPayloadMap } from '../platform/events';

import { DOMAIN_EVENTS, DomainEventPayloadMap } from '../domain/events';

export const EVENTS = {
  ...PLATFORM_EVENTS,
  ...DOMAIN_EVENTS,

} as const;

export type EventPayloadMap = PlatformEventPayloadMap & DomainEventPayloadMap;
