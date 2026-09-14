import helmet from 'helmet';
import { HelmetMiddleware } from './helmet.middleware';
import { SecurityModuleConfig } from '../security.config';

jest.mock('helmet');

describe('HelmetMiddleware', () => {
  const mockedHelmet = helmet as jest.MockedFunction<typeof helmet>;
  let handler: jest.Mock;

  beforeEach(() => {
    handler = jest.fn();
    mockedHelmet.mockReturnValue(handler as unknown as ReturnType<typeof helmet>);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const config: SecurityModuleConfig = { cors: { allowedOrigins: [] } };

  it('builds helmet with an empty object when no config.helmet is given', () => {
    new HelmetMiddleware(config);

    expect(mockedHelmet).toHaveBeenCalledWith({});
  });

  it('passes config.helmet through to helmet() when provided', () => {
    const helmetOptions = { contentSecurityPolicy: false };

    new HelmetMiddleware({ ...config, helmet: helmetOptions });

    expect(mockedHelmet).toHaveBeenCalledWith(helmetOptions);
  });

  it('delegates use() to the constructed helmet handler', () => {
    const middleware = new HelmetMiddleware(config);
    const req = {} as never;
    const res = {} as never;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(handler).toHaveBeenCalledWith(req, res, next);
  });
});
