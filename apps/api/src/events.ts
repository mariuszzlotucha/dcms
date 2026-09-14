// Single merged event registry — the "@" path alias (tsconfig.json / jest.config.js)
// resolves to this file. domain/ imports event names and payload types from here,
// never directly from platform/events.ts or domain/events.ts (see
// docs/dcms-domain-architecture.md section 6 and the DCMS CLAUDE.md invariant on
// event names never being magic strings).
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from './platform/events';
import { DOMAIN_EVENTS, DomainEventPayloadMap } from './domain/events';

export const EVENTS = {
  ...PLATFORM_EVENTS,
  ...DOMAIN_EVENTS,
} as const;

export type EventPayloadMap = PlatformEventPayloadMap & DomainEventPayloadMap;
