import nodemailer from 'nodemailer';

const user = process.env.MAIL_USER;
const pass = process.env.MAIL_PASS;
const host = process.env.MAIL_HOST;
const port = process.env.MAIL_PORT;
const service = process.env.MAIL_SERVICE;
const from = process.env.MAIL_FROM;

const transporter = nodemailer.createTransport({
  service,
  host,
  port,
  auth: { user, pass, secure: true },
  tls: { rejectUnauthorized: false },
  debug: true,
});

async function sendEmail(to, subject, html, attachments = []) {
  const options = {
    from, to, subject, html, attachments,
  };

  try {
    const info = await transporter.sendMail(options);
    console.log(`'${subject}' para ${to}:`, info.messageId, `with ${options.attachments.length} attachments`);
    return true;
  } catch (error) {
    console.log('Could not send mail to ', to, 'Error => ', error);
    return { error };
  }
}

export default { sendEmail };
