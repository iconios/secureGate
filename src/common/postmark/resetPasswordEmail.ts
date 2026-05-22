import { transporter } from './mailer';

// Password reset Email Function
const sendPasswordResetEmail = async (
  email: string,
  resetPasswordToken: string,
  fullName: string,
) => {
  const resetPasswordUrl = `${process.env.BASE_URL}/manager/reset-password?token=${resetPasswordToken}`;
  const fromAddress = `"${process.env.APP_NAME}" <${process.env.MAIL_FROM}>`;
  const mailOptions = {
    From: fromAddress,
    To: email,
    Subject: 'Please Reset your Password',
    MessageStream: 'outbound',
    HtmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset</h2>
        <p>Hello ${fullName},</p>
        <p>You requested to reset your password. Click the button below to proceed:</p>
        <a href="${resetPasswordUrl}" 
           style="display: inline-block; padding: 12px 24px; background-color: #dc3545; 
                  color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          Reset Password
        </a>
        <p>Or copy and paste this link in your browser:</p>
        <p>${resetPasswordUrl}</p>
        <p>This link will expire in 30 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>`,
  };

  // Send password reset email
  try {
    await transporter.sendEmail(mailOptions);
    console.log('Password reset email sent to', email);
  } catch (error) {
    console.log('Error sending password reset email', error);
  }
};

export default sendPasswordResetEmail;
