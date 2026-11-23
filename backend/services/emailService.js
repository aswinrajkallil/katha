import nodemailer from "nodemailer";

// Thin wrapper around Nodemailer.
//
// Configure SMTP through SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASS and set
// EMAIL_FROM for the sender address (any SMTP provider works: Gmail app password, Brevo, Resend SMTP...).
//
// When SMTP is not configured:
//   - development / test: the message is printed to the server console so the flow can be tried locally
//   - production: sending fails loudly, so a missing configuration is never mistaken for "email sent"

let transporter = null;

const smtpConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
    if (transporter) return transporter;
    if (!smtpConfigured()) return null;
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE === "true" || port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    return transporter;
};

// Lets tests swap in a fake transport instead of talking to a real SMTP server.
export const setTransporter = (next) => { transporter = next; };

const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const sendEmail = async ({ to, subject, text, html }) => {
    const active = getTransporter();
    if (!active) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("Email is not configured: set SMTP_HOST, SMTP_USER and SMTP_PASS");
        }
        console.log(`[email] SMTP not configured, printing instead of sending.\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
        return;
    }
    await active.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        html
    });
};

export const sendPasswordResetEmail = ({ to, name, link, expiresInMinutes }) => {
    const greeting = name ? `Hi ${name},` : "Hi,";
    const text = [
        greeting,
        "",
        "We received a request to reset the password for your Kathā account.",
        `Use the link below to choose a new password. It expires in ${expiresInMinutes} minutes and can be used once:`,
        "",
        link,
        "",
        "If you did not ask for this, you can ignore this email. Your password will not change."
    ].join("\n");

    const safeLink = escapeHtml(link);
    const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#1f2937;line-height:1.5">
  <p>${escapeHtml(greeting)}</p>
  <p>We received a request to reset the password for your Kathā account.</p>
  <p>
    <a href="${safeLink}" style="display:inline-block;background:#e8590c;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Reset password</a>
  </p>
  <p style="font-size:14px;color:#4b5563">This link expires in ${expiresInMinutes} minutes and can be used once. If the button does not work, copy this address into your browser:<br><span style="word-break:break-all">${safeLink}</span></p>
  <p style="font-size:14px;color:#4b5563">If you did not ask for this, you can ignore this email. Your password will not change.</p>
</div>`;

    return sendEmail({ to, subject: "Reset your Kathā password", text, html });
};
