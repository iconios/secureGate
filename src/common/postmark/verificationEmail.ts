import { randomUUID } from 'crypto';
import logger from '../winston/logger.js';
import { transporter } from './mailer.js';
import { redactEmailUsername } from '../../utils/redactEmailUsername.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';

const sendVerificationEmail = async (email: string, code: string, fullName: string) => {
  const emailLogs = logger.child({
    service: 'sendVerificationEmail',
    requestId: randomUUID(),
  });

  const fromAddress = `"${process.env.APP_NAME}" <${process.env.MAIL_FROM}>`;
  const mailOptions = {
    From: fromAddress,
    To: email,
    Subject: 'Verify your Email',
    MessageStream: 'outbound',
    HtmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Email Verification Code</h2>
        <p>Hello ${fullName},</p>
        <p>Thank you for registering with SecureGate! Please Use this verification code to complete email verification in the app:</p>
        <h1 style="font-size: 24px; color: #333;">${code}</h1>
        
        <p>This link will expire in 30 minutes.</p>

        <p>If you did not request this verification, please ignore this email.</p>

        <p>Best regards,<br/>The SecureGate Team</p>
      </div>`,
  };

  // Send verification email
  try {
    await transporter.sendEmail(mailOptions);
    emailLogs.info('Verification email sent', {
      email: redactEmailUsername(email),
    });
    return successResponseHelper('Verification email sent', {
      email: redactEmailUsername(email),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Error sending verification email';
    emailLogs.error(errorMessage, {
      email: redactEmailUsername(email),
      error,
    });
    return errorResponseHelper(errorMessage, 'EMAIL_SEND_ERROR', errorMessage);
  }
};

export default sendVerificationEmail;
