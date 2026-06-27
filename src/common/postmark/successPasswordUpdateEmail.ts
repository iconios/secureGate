import { randomUUID } from 'crypto';
import logger from '../winston/logger.js';
import { transporter } from './mailer.js';
import { redactEmailUsername } from '../../utils/redactEmailUsername.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';

const sendPasswordUpdateSuccessfulEmail = async (
  email: string,
  fullName: string,
  dateTime: Date,
) => {
  const emailLogs = logger.child({
    service: 'sendPasswordUpdateSuccessfulEmail',
    requestId: randomUUID(),
  });
  const fromAddress = `"${process.env.APP_NAME}" <${process.env.MAIL_FROM}>`;
  const mailOptions = {
    From: fromAddress,
    To: email,
    Subject: 'Password Update Success — Notification',
    MessageStream: 'outbound',
    HtmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Updated Successfully</h2>
        <p>Hello ${fullName},</p>
        <p style="margin:0 0 16px; font-size:15px; line-height:1.6;"> 
            Your password was successfully updated on <strong>${dateTime}</strong>. 
        </p>
        <p style="margin:0 0 16px; font-size:15px; line-height:1.6;"> 
            If you made this change, no further action is required. 
        </p> 
        <p style="margin:0 0 24px; font-size:15px; line-height:1.6;"> 
            If you did not update your password, please contact support immediately. 
        </p>

        <p>Best regards,<br/>The SecureGate Team</p>
      </div>`,
  };

  // Send the password update successful email
  try {
    await transporter.sendEmail(mailOptions);
    emailLogs.info('Password update successful email sent', {
      email: redactEmailUsername(email),
    });
    return successResponseHelper('Password update successful email sent', {
      email: redactEmailUsername(email),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Error sending password update email';
    emailLogs.error(errorMessage, {
      email: redactEmailUsername(email),
      error,
    });
    return errorResponseHelper(errorMessage, 'EMAIL_SEND_ERROR', errorMessage);
  }
};

export default sendPasswordUpdateSuccessfulEmail;
