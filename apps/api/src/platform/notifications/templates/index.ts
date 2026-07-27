import { PasswordResetTemplateData, buildPasswordResetTemplate } from './password-reset.template';
import { WelcomeTemplateData, buildWelcomeTemplate } from './welcome.template';

export interface NotificationTemplateDataMap {
  welcome: WelcomeTemplateData;
  'password-reset': PasswordResetTemplateData;
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
};
