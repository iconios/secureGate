import { transporter } from './mailer';

const sendVerificationEmail = async (email: string, token: string, fullName: string) => {
  const verificationUrl = `${process.env.BASE_URL}/manager-auth/verify-email?token=${token}`;
  const fromAddress = `"${process.env.APP_NAME}" <${process.env.MAIL_FROM}>`;
  const mailOptions = {
    From: fromAddress,
    To: email,
    Subject: 'Verify your Email',
    MessageStream: 'outbound',
    HtmlBody: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Email Verification</h2>
        <p>Hello ${fullName},</p>
        <p>Thank you for registering with SecureGate! Please click the button below to verify your email address:</p>
        <a href="${verificationUrl}" 
           style="display: inline-block; padding: 12px 24px; background-color: #007bff; 
                  color: white; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          Verify Email
        </a>
        <p>Or copy and paste this link in your browser:</p>
        <p>${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
      </div>`,
  };

  // Send verification email
  try {
    await transporter.sendEmail(mailOptions);
    console.log('Verification email sent to', email);
  } catch (error) {
    console.log('Error sending verification email', error);
  }
};

export default sendVerificationEmail;
