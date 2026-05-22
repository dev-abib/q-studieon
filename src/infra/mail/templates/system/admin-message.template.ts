import { baseTemplate } from '../base.template';
import { AdminMessageProps } from './../template.type';

export const adminMessageTemplate = ({
  userName,
  adminName,
  subject,
  message,
}: AdminMessageProps): string => {
  const sentAt = new Date().toUTCString();

  const formattedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  const content = `
    <p style="margin:0 0 6px;font-size:15px;color:#374151;">
      Hi, <strong style="color:#111827;font-weight:600;">${userName}</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      You have a new message from the platform admin. Please read the message below.
    </p>

    <!-- Subject banner -->
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:#fffbeb;
      border:1.5px solid #fde68a;
      border-radius:14px;
      margin-bottom:20px;
    ">
      <tr>
        <td style="padding:20px 22px;">
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="vertical-align:middle;padding-right:14px;width:44px;">
                <div style="
                  width:44px;
                  height:44px;
                  background:#f59e0b;
                  border-radius:50%;
                  text-align:center;
                  line-height:44px;
                  font-size:20px;
                  color:#ffffff;
                ">✉</div>
              </td>
              <td style="vertical-align:middle;">
                <p style="
                  margin:0 0 3px;
                  font-size:11px;
                  font-weight:600;
                  letter-spacing:0.08em;
                  text-transform:uppercase;
                  color:#92400e;
                ">Message from Admin</p>
                <p style="
                  margin:0;
                  font-size:16px;
                  font-weight:700;
                  color:#78350f;
                  line-height:1.3;
                ">${subject}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Message body -->
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:#fafafa;
      border:1px solid #e5e7eb;
      border-radius:10px;
      margin-bottom:16px;
    ">
      <tr>
        <td style="padding:20px 22px;">
          <p style="
            margin:0 0 12px;
            font-size:12px;
            font-weight:600;
            letter-spacing:0.07em;
            text-transform:uppercase;
            color:#9ca3af;
          ">Message</p>
          <p style="
            margin:0;
            font-size:14px;
            color:#374151;
            line-height:1.75;
          ">${formattedMessage}</p>
        </td>
      </tr>
    </table>

    <!-- Sender info -->
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:#fafafa;
      border:1px solid #e5e7eb;
      border-radius:10px;
      margin-bottom:16px;
    ">
      <tr>
        <td style="padding:14px 18px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;">Message details</p>
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding:4px 0;font-size:12.5px;color:#6b7280;width:120px;">
                Sent by
              </td>
              <td style="padding:4px 0;font-size:12.5px;color:#111827;font-weight:500;">
                ${adminName}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:12.5px;color:#6b7280;">
                Sent on
              </td>
              <td style="padding:4px 0;font-size:12.5px;color:#111827;font-weight:500;">
                ${sentAt}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:12.5px;color:#6b7280;">
                Recipient
              </td>
              <td style="padding:4px 0;font-size:12.5px;color:#111827;font-weight:500;">
                ${userName}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Warning note -->
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:#fef2f2;
      border:1px solid #fecaca;
      border-radius:10px;
      margin-bottom:16px;
    ">
      <tr>
        <td style="padding:12px 14px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;padding-right:10px;">
                <div style="
                  width:18px;height:18px;
                  background:#ef4444;
                  border-radius:50%;
                  text-align:center;
                  line-height:18px;
                  font-size:10px;
                  font-weight:700;
                  color:#ffffff;
                ">!</div>
              </td>
              <td style="font-size:12.5px;color:#991b1b;line-height:1.55;">
                This message was sent directly by a platform administrator. Please do not reply to this email — contact support if you have questions.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Friendly note -->
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:#f0fdf4;
      border:1px solid #bbf7d0;
      border-radius:10px;
    ">
      <tr>
        <td style="padding:12px 14px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;padding-right:10px;">
                <div style="
                  width:18px;height:18px;
                  background:#22c55e;
                  border-radius:50%;
                  text-align:center;
                  line-height:18px;
                  font-size:10px;
                  font-weight:700;
                  color:#ffffff;
                ">♥</div>
              </td>
              <td style="font-size:12.5px;color:#166534;line-height:1.55;">
                If you have any concerns about this message or your account, our support team is always here to help.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return baseTemplate({
    title: `New Message from Admin — ${process.env.MAIL_FROM_NAME as string}`,
    content,
  });
};
