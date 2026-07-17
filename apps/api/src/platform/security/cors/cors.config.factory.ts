import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { SecurityModuleConfig } from '../security.config';

/**
 * Builds CORS options from the security config. Applied in main.ts:
 *
 *   app.enableCors(createCorsOptions(app.get(SECURITY_MODULE_CONFIG)));
 *
 * (Nest applies CORS at the HTTP adapter level, before the module system —
 * a module can't enable it by itself, hence the exported factory.)
 */
export function createCorsOptions(config: SecurityModuleConfig): CorsOptions {
  const allowlist = new Set(config.cors.allowedOrigins);

  return {
    origin: (origin, callback) => {
      // No Origin header = non-browser client (curl, S2S, health checks) —
      // CORS doesn't apply to those, let them through.
      // Disallowed origins get (null, false), not an Error: the browser
      // blocks the response for lack of CORS headers anyway, and an Error
      // here would 500 + stack-trace-spam the logs on every scanner probe.
      callback(null, !origin || allowlist.has(origin));
    },
    credentials: true,
  };
}
