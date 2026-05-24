import { transporter } from './mailer';

// Html escape function
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

// Password reset Email Function
const sendPasswordResetEmail = async (
  email: string,
  resetPasswordToken: string,
  fullName: string,
  requestId: string,
) => {
  const baseUrl = process.env.BASE_URL;
  const appName = process.env.APP_NAME;
  const mailFrom = process.env.MAIL_FROM;

  if (!baseUrl || !appName || !mailFrom) {
    throw new Error('Missing required email environment variables');
  }

  const resetPasswordUrl = `${baseUrl}/api/v1/managers/validate-password-token?token=${encodeURIComponent(resetPasswordToken)}&request_id=${encodeURIComponent(requestId)}`;
  const fromAddress = `"${appName}" <${mailFrom}>`;
  const mailOptions = {
    From: fromAddress,
    To: email,
    Subject: 'Reset your password',
    MessageStream: 'outbound',
    HtmlBody: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>Hello ${escapeHtml(fullName || 'there')},</p>
        <p>You requested to reset your password. Click the button below to proceed:</p>
        <p>
          <a href="${resetPasswordUrl}" style="display: inline-block; padding: 12px 24px; background-color: #dc3545; 
                  color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
            Reset Password
          </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>

        <p style="word-break: break-all;">
          <a href="${resetPasswordUrl}">${resetPasswordUrl}</a>
        </p>
        <p>This link will expire in 30 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Thank you, <br />${appName}</p>
      </div>
      `,
  };

  // Send password reset email
  try {
    await transporter.sendEmail(mailOptions);
    console.log('Password reset email sent to', email);
  } catch (error) {
    console.log('Error sending password reset email', error);
    throw error;
  }
};

export default sendPasswordResetEmail;
