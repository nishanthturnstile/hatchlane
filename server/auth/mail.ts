import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  host: process.env.HATCHLANE_SMTP_HOST ?? "mailpit",
  port: 1025,
  connectionTimeout: 3000,
  greetingTimeout: 3000,
  socketTimeout: 5000,
});

export async function sendAccountEmail(
  email: string,
  subject: string,
  text: string,
) {
  await transport.sendMail({
    from: "Hatchlane <accounts@hatchlane.localhost>",
    to: { name: "", address: email },
    subject,
    text,
  });
}
