import { randomUUID } from 'crypto';
import logger from '../winston/logger.js';
import { transporter } from './mailer.js';
import { redactEmailUsername } from '../../utils/redactEmailUsername.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';

// Estate Manager Payment Update email function
const sendEstateSubscriptionNotificationEmail = async (
  email: string,
  full_name: string,
  estate_name: string,
  plan_name: string,
  currency: string,
  amount: number,
  reference: string,
  expires_at: string,
  period: string,
  baseUrl: string,
) => {
  const emailLogs = logger.child({
    service: 'sendEstateSubscriptionNotificationEmail',
    requestId: randomUUID(),
  });

  if (
    !email ||
    !full_name ||
    !estate_name ||
    !plan_name ||
    !currency ||
    amount <= 0 ||
    !reference ||
    !expires_at ||
    !period ||
    !baseUrl
  ) {
    emailLogs.warn('Estate subscription email arguments missing', {
      email: email ? redactEmailUsername(email) : undefined,
      hasFullName: Boolean(full_name),
      hasEstateName: Boolean(estate_name),
      hasPlanName: Boolean(plan_name),
      currency,
      amount,
      reference,
      expires_at,
      period,
      hasBaseUrl: Boolean(baseUrl),
    });

    return errorResponseHelper(
      'Estate subscription email arguments missing',
      'EMAIL_ARGUMENTS_MISSING',
      'Estate subscription email arguments missing',
    );
  }

  const appName = process.env.APP_NAME;
  const mailFrom = process.env.MAIL_FROM;

  if (!appName || !mailFrom) {
    emailLogs.warn('Email sender configuration missing', {
      email: redactEmailUsername(email),
    });
    return errorResponseHelper(
      'Email sender configuration missing',
      'EMAIL_SENDER_CONFIG_MISSING',
      'Email sender configuration missing',
    );
  }

  const fromAddress = `"${appName}" <${mailFrom}>`;
  const dashboardUrl = `${baseUrl}/dashboard`;
  const mailOptions = {
    From: fromAddress,
    To: email,
    Subject: 'Successful Estate Subscription Notification',
    MessageStream: 'outbound',
    HtmlBody: `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Received</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: Arial, sans-serif; color: #333333;">
        <p>Hello ${full_name},</p>

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9f9f9; padding: 20px;">
                <tr>
                    <td align="center">
                        
                        <!-- Card Container -->
                        <table role="presentation" width="100%" style="max-width: 500px; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 6px; padding: 30px;">
                            
                            <!-- Header -->
                            <tr>
                                <td style="padding-bottom: 20px; border-bottom: 1px solid #eeeeee;">
                                    <h1 style="font-size: 20px; font-weight: bold; margin: 0; color: #0c1a30;">Payment Confirmed</h1>
                                    <p style="font-size: 14px; color: #666666; margin: 4px 0 0 0;">Your estate subscription is now active.</p>
                                </td>
                            </tr>

                            <!-- Details -->
                            <tr>
                                <td style="padding: 20px 0;">
                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="font-size: 14px; line-height: 20px;">
                                        <tr>
                                            <td style="color: #666666; padding-bottom: 8px;" width="40%">Estate:</td>
                                            <td style="color: #111111; font-weight: bold; padding-bottom: 8px;">${estate_name}</td>
                                        </tr>
                                        <tr>
                                            <td style="color: #666666; padding-bottom: 8px;">Plan:</td>
                                            <td style="color: #111111; padding-bottom: 8px; text-transform: capitalize;">${plan_name} (${period})</td>
                                        </tr>
                                        <tr>
                                            <td style="color: #666666; padding-bottom: 8px;">Amount Paid:</td>
                                            <td style="color: #111111; font-weight: bold; padding-bottom: 8px;">${currency} ${amount.toLocaleString()}</td>
                                        </tr>
                                        <tr>
                                            <td style="color: #666666; padding-bottom: 8px;">Reference:</td>
                                            <td style="color: #111111; font-family: monospace; padding-bottom: 8px;">${reference}</td>
                                        </tr>
                                        <tr>
                                            <td style="color: #666666;">Valid Until:</td>
                                            <td style="color: #d32f2f; font-weight: bold;">${expires_at}</td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>

                            <!-- Button -->
                            <tr>
                                <td align="center" style="padding-top: 10px; padding-bottom: 10px;">
                                    <a href="${dashboardUrl}" target="_blank" style="background-color: #0c1a30; color: #ffffff; text-decoration: none; padding: 12px 24px; font-size: 14px; font-weight: bold; border-radius: 4px; display: inline-block;">Go to Dashboard</a>
                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td style="padding-top: 25px; border-top: 1px solid #eeeeee; text-align: center;">
                                    <p style="font-size: 12px; color: #999999; margin: 0;">© ${new Date().getFullYear()} Nerdy Web Consults. All rights reserved.</p>
                                </td>
                            </tr>

                        </table>

                    </td>
                </tr>
            </table>

        </body>
</html>
`,
  };

  // Send account successful verification email
  try {
    await transporter.sendEmail(mailOptions);
    emailLogs.info('Estate subscription payment email sent', {
      email: redactEmailUsername(email),
    });
    return successResponseHelper('Estate subscription payment email sent', {
      email: redactEmailUsername(email),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Error sending estate subscription payment email';
    emailLogs.error(errorMessage, {
      email: redactEmailUsername(email),
      error,
    });
    return errorResponseHelper(errorMessage, 'EMAIL_SEND_ERROR', errorMessage);
  }
};

export { sendEstateSubscriptionNotificationEmail };
