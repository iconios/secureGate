import { transporter } from './mailer.js';

const sendPasswordUpdateSuccessfulEmail = async (
  email: string,
  fullName: string,
  dateTime: Date,
) => {
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
    console.log('Password update successful email sent to', email);
  } catch (error) {
    console.log('Error sending password update successful email', error);
  }
};

export default sendPasswordUpdateSuccessfulEmail;
