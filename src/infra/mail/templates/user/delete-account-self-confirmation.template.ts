import { baseTemplate } from '../base.template';
import { DeleteAccountConfirmationProps } from '../template.type';

export const deleteAccountConfirmationTemplate = ({
  name,
}: DeleteAccountConfirmationProps): string => {
  const content = `
    <p style="margin:0 0 6px;font-size:15px;color:#374151;">
      Hi, <strong style="color:#111827;font-weight:600;">${name}</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      Your account has been permanently deleted. We're sorry to see you go. All your data has been removed from our systems.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:#fef2f2;
      border:1.5px solid #fecaca;
      border-radius:14px;
      margin-bottom:20px;
    ">
      <tr>
        <td style="padding:24px 20px;text-align:center;">
          <div style="
            width:56px;
            height:56px;
            background:#ef4444;
            border-radius:50%;
            margin:0 auto 14px;
            text-align:center;
            line-height:56px;
            font-size:24px;
            color:#ffffff;
          ">🗑️</div>
          <p style="
            margin:0 0 6px;
            font-size:16px;
            font-weight:700;
            color:#b91c1c;
          ">Account Deleted Successfully</p>
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
            Your account and all associated data have been permanently removed.
          </p>
          <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">
            Deleted on <strong style="color:#374151;">${new Date().toUTCString()}</strong>
          </p>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:#fafafa;
      border:1px solid #e5e7eb;
      border-radius:10px;
      margin-bottom:16px;
    ">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;">What has been removed:</p>
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding:4px 0;font-size:12.5px;color:#6b7280;">
                ✓ &nbsp; Personal information and profile data
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:12.5px;color:#6b7280;">
                ✓ &nbsp; Account credentials and authentication data
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:12.5px;color:#6b7280;">
                ✓ &nbsp; All associated content and preferences
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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
                ">✕</div>
              </td>
              <td style="font-size:12.5px;color:#991b1b;line-height:1.55;">
                If you did not request this deletion, please contact our support team immediately. This action is irreversible.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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
                We'd love to have you back someday. You can always create a new account at any time.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return baseTemplate({
    title: `Account Deleted — ${process.env.MAIL_FROM_NAME as string}`,
    content,
  });
};
