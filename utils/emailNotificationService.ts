import { triggerBrowserNotification } from './browserNotifications';

/**
 * Service to dispatch email notifications using the existing notification infrastructure.
 * This simulates sending an email by triggering a desktop alert containing the email summary.
 */
export const dispatchEmailNotification = (subject: string, body: string, recipient: string = 'compliance-team@vault.local') => {
  console.log(`[EMAIL DISPATCHED] To: ${recipient} | Subject: ${subject}`);
  
  // Forward to existing notification infrastructure for preview/visibility
  triggerBrowserNotification(`📧 Email: ${subject}`, {
    body: `${body}\n\n(Sent to ${recipient})`,
    force: true, // Bypass rate-limits for critical emails
  });
};
