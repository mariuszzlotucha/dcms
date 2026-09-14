import { buildWelcomeTemplate } from './welcome.template';
import { buildPasswordResetTemplate } from './password-reset.template';
import { buildReminderTemplate } from './reminder.template';
import { buildSubscriptionUpdatedTemplate } from './subscription-updated.template';

describe('buildWelcomeTemplate', () => {
  it('interpolates the recipient name into the body', () => {
    const result = buildWelcomeTemplate({ recipientName: 'Jane' });

    expect(result.subject).toBe('Welcome to DCMS');
    expect(result.body).toContain('Jane');
  });
});

describe('buildPasswordResetTemplate', () => {
  it('interpolates the reset link into the body', () => {
    const result = buildPasswordResetTemplate({ resetLink: 'https://dcms.app/reset/abc' });

    expect(result.subject).toBe('Reset your DCMS password');
    expect(result.body).toContain('https://dcms.app/reset/abc');
  });
});

describe('buildReminderTemplate', () => {
  it('uses the specific copy for a known reminder type', () => {
    const result = buildReminderTemplate({ contractId: 'c1', reminderType: 'pending_signature' });

    expect(result.body).toContain('Your signature is still pending on this contract.');
    expect(result.body).toContain('c1');
  });

  it('falls back to generic copy for an unknown reminder type', () => {
    const result = buildReminderTemplate({ contractId: 'c1', reminderType: 'something_new' });

    expect(result.body).toContain('This contract needs your attention.');
  });
});

describe('buildSubscriptionUpdatedTemplate', () => {
  it('interpolates the plan name and status into the body', () => {
    const result = buildSubscriptionUpdatedTemplate({ planName: 'Pro', status: 'active' });

    expect(result.subject).toBe('Your DCMS subscription has been updated');
    expect(result.body).toContain('Pro');
    expect(result.body).toContain('active');
  });
});
