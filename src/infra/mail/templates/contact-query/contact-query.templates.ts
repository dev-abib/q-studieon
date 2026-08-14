import { baseTemplate } from '../base.template';

export interface NewContactQueryEmailProps {
  name: string;
  email: string;
  subject: string;
  message: string;
  isRegisteredUser: boolean;
  queryId: string;
}

export const newContactQueryNotificationTemplate = ({
  name,
  email,
  subject,
  message,
  isRegisteredUser,
  queryId,
}: NewContactQueryEmailProps): string => {
  const siteName = (process.env.SITE_NAME as string) ?? 'Dwellr';
  const frontendUrl =
    process.env.ADMIN_FRONTEND_URL ||
    process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === 'production'
      ? 'https://admin.dwellr.tech'
      : 'http://localhost:3003');
  const queryUrl = `${frontendUrl}/dashboard/queries`;

  const content = `
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b;">
      Hello <strong>Admin / Site Owner</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;">
      A new user inquiry has just been submitted on <strong>${siteName}</strong>.
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;">
        <tr>
          <td style="padding-bottom:10px;color:#64748b;width:120px;font-weight:600;">Sender Name:</td>
          <td style="padding-bottom:10px;color:#0f172a;font-weight:600;">${name}</td>
        </tr>
        <tr>
          <td style="padding-bottom:10px;color:#64748b;font-weight:600;">Sender Email:</td>
          <td style="padding-bottom:10px;color:#0f172a;"><a href="mailto:${email}" style="color:#16a34a;text-decoration:none;">${email}</a></td>
        </tr>
        <tr>
          <td style="padding-bottom:10px;color:#64748b;font-weight:600;">User Status:</td>
          <td style="padding-bottom:10px;">
            ${
              isRegisteredUser
                ? `<span style="background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:6px;font-weight:600;font-size:11px;border:1px solid #bbf7d0;">✓ Registered App User</span>`
                : `<span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:6px;font-weight:500;font-size:11px;">Guest / Visitor</span>`
            }
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:10px;color:#64748b;font-weight:600;">Subject:</td>
          <td style="padding-bottom:10px;color:#0f172a;font-weight:600;">${subject}</td>
        </tr>
      </table>

      <div style="border-top:1px solid #e2e8f0;padding-top:14px;margin-top:4px;">
        <p style="margin:0 0 6px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Message Content:</p>
        <p style="margin:0;color:#334155;font-size:14px;white-space:pre-line;line-height:1.6;background:#ffffff;padding:12px;border-radius:8px;border:1px solid #cbd5e1;">
          ${message}
        </p>
      </div>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <a href="${queryUrl}" style="
        display:inline-block;
        background:#16a34a;
        color:#ffffff;
        font-weight:600;
        font-size:14px;
        padding:12px 28px;
        border-radius:10px;
        text-decoration:none;
        box-shadow:0 2px 4px rgba(22,163,74,0.2);
      ">View in Admin Dashboard &rarr;</a>
    </div>
  `;

  return baseTemplate({
    title: `New Inquiry: ${subject}`,
    content,
  });
};

export interface ContactQueryReplyEmailProps {
  userName: string;
  subject: string;
  originalMessage: string;
  replyMessage: string;
  responderName: string;
}

export const contactQueryReplyTemplate = ({
  userName,
  subject,
  originalMessage,
  replyMessage,
  responderName,
}: ContactQueryReplyEmailProps): string => {
  const siteName = (process.env.SITE_NAME as string) ?? 'Dwellr';

  const content = `
    <p style="margin:0 0 16px;font-size:15px;color:#1e293b;">
      Hi <strong>${userName}</strong>,
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
      Thank you for reaching out to <strong>${siteName}</strong> support. Here is our response regarding your inquiry on <strong>"${subject}"</strong>:
    </p>

    <!-- Admin Response Box -->
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:14px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;color:#15803d;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">
        Response from ${responderName || 'Support Team'}:
      </p>
      <div style="color:#0f172a;font-size:14.5px;line-height:1.7;white-space:pre-line;">
        ${replyMessage}
      </div>
    </div>

    <!-- Original Message Context -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 6px;color:#64748b;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">
        Your Original Message:
      </p>
      <p style="margin:0;color:#64748b;font-size:13px;font-style:italic;line-height:1.6;white-space:pre-line;">
        "${originalMessage}"
      </p>
    </div>

    <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
      If you have any further questions, feel free to reply directly to this email or visit our support center.
    </p>
  `;

  return baseTemplate({
    title: `Response: ${subject}`,
    content,
  });
};
