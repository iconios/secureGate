import { transporter } from './mailer.js';

// Account successful verification email function
const sendSuccessVerificationEmail = async (email: string, fullName: string) => {
  const fromAddress = `"${process.env.APP_NAME}" <${process.env.MAIL_FROM}>`;
  const mailOptions = {
    From: fromAddress,
    To: email,
    Subject: 'Successful Account Verification',
    MessageStream: 'outbound',
    HtmlBody: `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Account Verified Successfully</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333333;
                    margin: 0;
                    padding: 0;
                    background-color: #f7f7f7;
                }
                .email-container {
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #ffffff;
                }
                .email-header {
                    background-color: #2c3e50;
                    padding: 20px;
                    text-align: center;
                }
                .email-body {
                    padding: 30px;
                }
                .email-footer {
                    background-color: #f2f2f2;
                    padding: 20px;
                    text-align: center;
                    font-size: 12px;
                    color: #666666;
                }
                h1 {
                    color: #ffffff;
                    margin: 0;
                    font-size: 24px;
                }
                h2 {
                    color: #2c3e50;
                    margin-top: 0;
                }
                .button {
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #3498db;
                    color: #ffffff;
                    text-decoration: none;
                    border-radius: 4px;
                    margin: 20px 0;
                }
                .divider {
                    border-top: 1px solid #eeeeee;
                    margin: 25px 0;
                }
                .logo {
                    color: #ffffff;
                    font-size: 24px;
                    font-weight: bold;
                    text-decoration: none;
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="email-header">
                    <a href="#" class="logo">Nerdy Web Consults</a>
                </div>
                
                <div class="email-body">
                    <h2>Your Account Has Been Verified</h2>
                    <p>Hello ${fullName},</p>
                    <p>We're pleased to inform you that your account has been successfully verified. You now have full access to all features and services.</p>
                    
                    <div class="divider"></div>
                    
                    <p><strong>What's next?</strong></p>
                    <ul>
                        <li>Check out our features</li>
                    </ul>
                    
                    <div style="text-align: center;">
                        <a href="#" class="button">Get Started</a>
                    </div>
                    
                    <div class="divider"></div>
                    
                    <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                    
                    <p>Welcome aboard!<br>Nerdy Web Consults Team</p>
                </div>
                
                <div class="email-footer">
                    <p>© ${new Date().getFullYear()} Nerdy Web Consults. All rights reserved.</p>
                    <p>123 Lagos, Suite 100, Lagos 12345, Nigeria</p>
                    <p>
                        <a href="#">Privacy Policy</a> | 
                        <a href="#">Terms of Service</a>
                    </p>
                    <p>This is an automated message, please do not reply directly to this email.</p>
                </div>
            </div>
        </body>
        </html>`,
  };

  // Send account successful verification email
  try {
    await transporter.sendEmail(mailOptions);
    console.log('Account successful verification email sent to', email);
  } catch (error) {
    console.log('Error sending account successful verification email', error);
  }
};

export { sendSuccessVerificationEmail };
