import { baseTemplate } from '../base.template';
import { SystemDeleteAccountProps } from '../template.type';

export const systemDeleteAccountTemplate = ({
  name,
  reason,
  deletedBy = 'System Administrator',
  supportEmail,
}: SystemDeleteAccountProps): string => {
  const content = `
    <p style="margin:0 0 6px;font-size:15px;color:#374151;">
      Hi, <strong style="color:#111827;font-weight:600;">${name}</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      We're writing to inform you that your account has been removed from our platform by our administrative team.
    </p>

    <!-- Header Status Card -->
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
            background:#dc2626;
            border-radius:50%;
            margin:0 auto 14px;
            text-align:center;
            line-height:56px;
            font-size:24px;
            color:#ffffff;
          ">⚠️</div>
          <p style="
            margin:0 0 6px;
            font-size:16px;
            font-weight:700;
            color:#b91c1c;
          ">Account Removed by System</p>
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
            This action was performed by <strong style="color:#374151;">${deletedBy}</strong>.
          </p>
          <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">
            Removed on <strong style="color:#374151;">${new Date().toUTCString()}</strong>
          </p>
        </td>
      </tr>
    </table>

    <!-- Reason Card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:#fafafa;
      border:1px solid #e5e7eb;
      border-radius:10px;
      margin-bottom:16px;
    ">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#374151;">Reason for removal:</p>
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding:4px 0;font-size:12.5px;color:#6b7280;">
                ✓ &nbsp; ${reason ?? 'Violation of our Terms of Service or Community Guidelines'}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:12.5px;color:#6b7280;">
                ✓ &nbsp; Account credentials and authentication data have been revoked
              </td>
            </tr>
            <tr>
              <td style="padding:4px 0;font-size:12.5px;color:#6b7280;">
                ✓ &nbsp; All associated content and access have been removed
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Warning Card -->
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
                This action was initiated by our system and is irreversible. You will no longer be able to log in or access any data associated with this account.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Support Card -->
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:#eff6ff;
      border:1px solid #bfdbfe;
      border-radius:10px;
    ">
      <tr>
        <td style="padding:12px 14px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;padding-right:10px;">
                <div style="
                  width:18px;height:18px;
                  background:#3b82f6;
                  border-radius:50%;
                  text-align:center;
                  line-height:18px;
                  font-size:10px;
                  font-weight:700;
                  color:#ffffff;
                ">i</div>
              </td>
              <td style="font-size:12.5px;color:#1e40af;line-height:1.55;">
                If you believe this was a mistake, please contact our support team at
                <a href="mailto:${supportEmail}" style="color:#2563eb;font-weight:600;text-decoration:none;">${supportEmail}</a>.
                We'll review your case as soon as possible.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return baseTemplate({
    title: `Account Removed — ${process.env.MAIL_FROM_NAME as string}`,
    content,
  });
};
