import { Response } from 'express';
import { OauthStateStore } from './oauth-state.store';
import { SecretsService } from '@platform/secrets/secrets.service';

describe('OauthStateStore', () => {
  const masterKey = 'YkkIaULiSLii-sCOi-7NWZSC4VsKUjh9215_r5K4YKk='; // 32 bytes, base64
  let secrets: { getEncryptionMasterKey: jest.Mock };
  let store: OauthStateStore;
  let res: { cookie: jest.Mock; clearCookie: jest.Mock };

  const buildRequest = (cookies: Record<string, string> = {}) => ({
    cookies,
    res: res as unknown as Response,
  });

  beforeEach(() => {
    secrets = { getEncryptionMasterKey: jest.fn().mockReturnValue(masterKey) };
    store = new OauthStateStore(secrets as unknown as SecretsService);
    res = { cookie: jest.fn(), clearCookie: jest.fn() };
  });

  const storeState = (): { nonce: string; cookieValue: string } => {
    let nonce = '';
    store.store(buildRequest() as any, (_err, state) => {
      nonce = state as string;
    });
    const cookieValue = res.cookie.mock.calls[0][1] as string;
    return { nonce, cookieValue };
  };

  it('issues a nonce and sets a short-lived httpOnly cookie carrying its signature', () => {
    const { nonce, cookieValue } = storeState();

    expect(nonce).toHaveLength(32); // 24 random bytes, base64url
    expect(res.cookie).toHaveBeenCalledWith(
      'oauth_state',
      cookieValue,
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax', path: '/api/auth' }),
    );
  });

  it('verifies successfully when the query state matches the signed cookie', (done) => {
    const { nonce, cookieValue } = storeState();
    const req = buildRequest({ oauth_state: cookieValue });

    store.verify(req as any, nonce, (err, ok) => {
      expect(err).toBeNull();
      expect(ok).toBe(true);
      expect(res.clearCookie).toHaveBeenCalledWith('oauth_state', { path: '/api/auth' });
      done();
    });
  });

  it('rejects when there is no cookie at all (the CSRF case: attacker-supplied state, no matching cookie)', (done) => {
    const req = buildRequest({});

    store.verify(req as any, 'attacker-supplied-nonce', (err, ok, info) => {
      expect(err).toBeNull();
      expect(ok).toBe(false);
      expect(info?.message).toMatch(/unable to verify/i);
      done();
    });
  });

  it('rejects when the query state does not match what the cookie signs', (done) => {
    const { cookieValue } = storeState();
    const req = buildRequest({ oauth_state: cookieValue });

    store.verify(req as any, 'a-different-nonce', (err, ok, info) => {
      expect(err).toBeNull();
      expect(ok).toBe(false);
      expect(info?.message).toMatch(/invalid/i);
      done();
    });
  });

  it('rejects a tampered cookie signature even with the right nonce', (done) => {
    const { nonce, cookieValue } = storeState();
    const [expiresAt] = cookieValue.split('.');
    const tampered = `${expiresAt}.tampered-signature`;
    const req = buildRequest({ oauth_state: tampered });

    store.verify(req as any, nonce, (err, ok) => {
      expect(err).toBeNull();
      expect(ok).toBe(false);
      done();
    });
  });

  it('rejects an expired cookie even with a correct signature', (done) => {
    const { nonce, cookieValue } = storeState();
    const [, signature] = cookieValue.split('.');
    const expired = `${Date.now() - 1000}.${signature}`;
    const req = buildRequest({ oauth_state: expired });

    store.verify(req as any, nonce, (err, ok, info) => {
      expect(err).toBeNull();
      expect(ok).toBe(false);
      expect(info?.message).toMatch(/expired/i);
      done();
    });
  });
});
