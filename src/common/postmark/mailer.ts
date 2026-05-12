import { ServerClient } from 'postmark';
import * as dotenv from 'dotenv';
dotenv.config();

// Create transporter
const transporter = new ServerClient(process.env.POSTMARK_SERVER_TOKEN!);

// Verify transporter
const verifyMailer = async () => {
  if (process.env.NODE_ENV === 'test') return;

  try {
    const server = await transporter.getServer();
    console.log('Postmark connection verified. Server name:', server.Name);
    return true;
  } catch (error: any) {
    console.log('Postmark not reachable', error?.message);
    return false;
  }
};

export { transporter, verifyMailer };
