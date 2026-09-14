import { SecretsService } from '../../secrets/secrets.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('maps a JWT payload (sub, email) into an AuthenticatedUser (userId, email)', () => {
    const secrets = { getJwtSigningKey: jest.fn().mockReturnValue('secret') };
    const strategy = new JwtStrategy(secrets as unknown as SecretsService);

    const result = strategy.validate({ sub: 'u1', email: 'a@example.com' });

    expect(result).toEqual({ userId: 'u1', email: 'a@example.com' });
  });
});
