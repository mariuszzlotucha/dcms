import { Injectable } from '@nestjs/common';
import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { SecretsService } from '@platform/secrets/secrets.service';

const COOKIE_NAME = 'oauth_state';
const COOKIE_PATH = '/api/auth';
// Long enough for a real login (provider's own login/consent screen can
// take a while), short enough to bound how long a leaked/guessed cookie
// stays useful.
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Session-less replacement for passport-oauth2's built-in `state: true`
 * option. This app runs PassportModule with `{ session: false }` and has
 * no express-session, so the library's default SessionStore would throw
 * ("OAuth 2.0 authentication requires session support") the moment it's
 * enabled — which is presumably why neither OAuth strategy passes `state`
 * at all today, silently landing on passport-oauth2's NullStore instead
 * (verify() unconditionally returns true, i.e. no CSRF protection on the
 * OAuth login flow).
 *
 * This store gets the same protection without session state: the state
 * value handed to the provider is a random nonce; a signed copy of that
 * nonce (HMAC, not just an opaque session lookup) rides along in a
 * short-lived httpOnly cookie. On callback, the nonce from the `state`
 * query param must match what the cookie's signature says was actually
 * issued to this browser — the same double-submit-cookie idea as
 * SecurityModule's CsrfGuard, applied to the OAuth redirect instead of a
 * same-origin form submission.
 *
 * Shared as a single instance across every OAuth provider strategy —
 * it carries no provider identity or other state of its own, so that's
 * safe, and simpler than one store (and one cookie) per provider.
 */
@Injectable()
export class OauthStateStore {
  private readonly key: Buffer;

  constructor(secrets: SecretsService) {
    // HKDF, not the raw master key: domain-separates this HMAC key from
    // FieldEncryptionService's AES key, which is derived from the same
    // master key with a different `info` string.
    this.key = Buffer.from(
      hkdfSync(
        'sha256',
        secrets.getEncryptionMasterKey(),
        'platform-oauth-state',
        'hmac-sha256-v1',
        32,
      ),
    );
  }

  // Arity matters: passport-oauth2 dispatches on `store.length` /
  // `verify.length` to decide which call signature to invoke (see
  // node_modules/passport-oauth2/lib/strategy.js). 2 and 3 match the
  // same NullStore/SessionStore signatures it ships with.
  store(req: Request, callback: (err: Error | null, state?: string) => void): void {
    const nonce = randomBytes(24).toString('base64url');
    const expiresAt = Date.now() + STATE_TTL_MS;
    const cookieValue = `${expiresAt}.${this.sign(nonce, expiresAt)}`;

    req.res?.cookie(COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: true,
      // Must survive the provider's top-level cross-site GET redirect
      // back to our callback URL — 'strict' would drop the cookie on
      // exactly the request that needs it.
      sameSite: 'lax',
      maxAge: STATE_TTL_MS,
      path: COOKIE_PATH,
    });

    callback(null, nonce);
  }

  verify(
    req: Request,
    providedState: string,
    callback: (err: Error | null, ok?: boolean, info?: { message: string }) => void,
  ): void {
    const cookieValue = (req.cookies as Record<string, string> | undefined)?.[COOKIE_NAME];
    // Single use regardless of outcome — a state value is never valid twice.
    req.res?.clearCookie(COOKIE_NAME, { path: COOKIE_PATH });

    if (!cookieValue || !providedState) {
      callback(null, false, { message: 'Unable to verify authorization request state.' });
      return;
    }

    const [expiresAtRaw, signature] = cookieValue.split('.');
    const expiresAt = Number(expiresAtRaw);

    if (!Number.isFinite(expiresAt) || !signature || Date.now() > expiresAt) {
      callback(null, false, { message: 'Authorization request state has expired.' });
      return;
    }

    if (!this.signaturesMatch(signature, this.sign(providedState, expiresAt))) {
      callback(null, false, { message: 'Invalid authorization request state.' });
      return;
    }

    callback(null, true);
  }

  private sign(nonce: string, expiresAt: number): string {
    return createHmac('sha256', this.key).update(`${nonce}.${expiresAt}`).digest('base64url');
  }

  private signaturesMatch(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  }
}
