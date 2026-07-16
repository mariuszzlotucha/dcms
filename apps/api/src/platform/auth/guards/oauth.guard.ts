import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
  Type,
  mixin,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  AUTH_MODULE_CONFIG,
  AuthModuleConfig,
  OauthProviderName,
} from '../auth.config';

/**
 * Counterpart of the placeholder construction in the OAuth strategies:
 * returns 404 for providers absent from config, so a placeholder strategy
 * can never actually redirect anyone.
 */
export function OauthGuard(provider: OauthProviderName): Type<CanActivate> {
  @Injectable()
  class ProviderGuard extends AuthGuard(provider) {
    constructor(
      @Inject(AUTH_MODULE_CONFIG) readonly config: AuthModuleConfig,
    ) {
      super();
    }

    canActivate(context: ExecutionContext) {
      if (!this.config.oauth?.[provider]) {
        throw new NotFoundException(`${provider} login is not enabled`);
      }
      return super.canActivate(context);
    }
  }

  return mixin(ProviderGuard);
}
