import { createCorsOptions } from './cors.config.factory';
import { SecurityModuleConfig } from '../security.config';

describe('createCorsOptions', () => {
  const config: SecurityModuleConfig = {
    cors: { allowedOrigins: ['https://app.dcms.example'] },
  };

  it('always sends credentials: true', () => {
    expect(createCorsOptions(config).credentials).toBe(true);
  });

  it('allows requests with no Origin header (non-browser clients)', (done) => {
    const options = createCorsOptions(config);

    (
      options.origin as (
        origin: string | undefined,
        cb: (err: Error | null, allow?: boolean) => void,
      ) => void
    )(undefined, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
      done();
    });
  });

  it('allows an origin present in the allowlist', (done) => {
    const options = createCorsOptions(config);

    (
      options.origin as (
        origin: string | undefined,
        cb: (err: Error | null, allow?: boolean) => void,
      ) => void
    )('https://app.dcms.example', (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
      done();
    });
  });

  it('rejects an origin not in the allowlist without raising an error', (done) => {
    const options = createCorsOptions(config);

    (
      options.origin as (
        origin: string | undefined,
        cb: (err: Error | null, allow?: boolean) => void,
      ) => void
    )('https://evil.example', (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(false);
      done();
    });
  });
});
