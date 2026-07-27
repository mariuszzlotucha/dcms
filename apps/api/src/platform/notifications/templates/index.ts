import { PasswordResetTemplateData, buildPasswordResetTemplate } from './password-reset.template';
import { SubscriptionUpdatedTemplateData, buildSubscriptionUpdatedTemplate } from './subscription-updated.template';
import { WelcomeTemplateData, buildWelcomeTemplate } from './welcome.template';

export interface NotificationTemplateDataMap {
  welcome: WelcomeTemplateData;
  'password-reset': PasswordResetTemplateData;
  'subscription-updated': SubscriptionUpdatedTemplateData;
}

export type NotificationTemplateName = keyof NotificationTemplateDataMap;

export interface RenderedTemplate {
  subject: string;
  body: string;
}

export const NOTIFICATION_TEMPLATES: {
  [K in NotificationTemplateName]: (data: NotificationTemplateDataMap[K]) => RenderedTemplate;
} = {
  welcome: buildWelcomeTemplate,
  'password-reset': buildPasswordResetTemplate,
  'subscription-updated': buildSubscriptionUpdatedTemplate,
};
