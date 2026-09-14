import { Options } from 'pino-http';
import { DEFAULT_REDACT_PATHS, buildPinoHttpOptions } from './logging.module';

// buildPinoHttpOptions always returns a plain Options object in this
// codebase (never the DestinationStream/tuple variants of the return type),
// so tests narrow to that for property access.
const build = (config: Parameters<typeof buildPinoHttpOptions>[0]) =>
  buildPinoHttpOptions(config) as Options;

describe('buildPinoHttpOptions', () => {
  it('defaults to info level when none is configured', () => {
    const options = build({});

    expect(options.level).toBe('info');
  });

  it('respects a configured level', () => {
    const options = build({ level: 'debug' });

    expect(options.level).toBe('debug');
  });

  it('always redacts the default sensitive paths regardless of config', () => {
    const options = build({});

    expect(options.redact).toEqual(expect.arrayContaining(DEFAULT_REDACT_PATHS));
  });

  it('merges configured redact paths with the defaults, deduped', () => {
    const options = build({ redactPaths: ['req.body.ssn', 'req.headers.authorization'] });

    expect(options.redact).toEqual(
      expect.arrayContaining([...DEFAULT_REDACT_PATHS, 'req.body.ssn']),
    );
    expect(
      (options.redact as string[]).filter((path) => path === 'req.headers.authorization'),
    ).toHaveLength(1);
  });

  it('omits transport when prettyPrint is not enabled', () => {
    const options = build({});

    expect(options.transport).toBeUndefined();
  });

  it('configures pino-pretty transport when prettyPrint is enabled', () => {
    const options = build({ prettyPrint: true });

    expect(options.transport).toEqual({ target: 'pino-pretty', options: { singleLine: true } });
  });

  describe('genReqId', () => {
    const buildReqRes = (headerValue?: string | string[]) => {
      const setHeader = jest.fn();
      const req = { headers: headerValue === undefined ? {} : { 'x-request-id': headerValue } };
      const res = { setHeader };
      return { req, res, setHeader };
    };

    it('reuses an existing x-request-id header and echoes it back on the response', () => {
      const options = build({});
      const { req, res, setHeader } = buildReqRes('existing-id');

      const id = options.genReqId?.(req as never, res as never);

      expect(id).toBe('existing-id');
      expect(setHeader).toHaveBeenCalledWith('x-request-id', 'existing-id');
    });

    it('uses the first value when x-request-id arrives as an array', () => {
      const options = build({});
      const { req, res } = buildReqRes(['first-id', 'second-id']);

      const id = options.genReqId?.(req as never, res as never);

      expect(id).toBe('first-id');
    });

    it('generates a UUID and sets it on the response when no header is present', () => {
      const options = build({});
      const { req, res, setHeader } = buildReqRes(undefined);

      const id = options.genReqId?.(req as never, res as never) as string;

      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(setHeader).toHaveBeenCalledWith('x-request-id', id);
    });
  });
});
