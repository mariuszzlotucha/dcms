import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { SecurityModuleConfig } from '../security.config';


export function createCorsOptions(config: SecurityModuleConfig): CorsOptions {
  const allowlist = new Set(config.cors.allowedOrigins);

  return {
    origin: (origin, callback) => {

      if (!origin || allowlist.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
      }
    },
    credentials: true,
  };
}
