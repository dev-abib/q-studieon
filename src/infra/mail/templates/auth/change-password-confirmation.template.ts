import { baseTemplate } from '../base.template';

interface ChangePasswordConfirmationProps {
  name: string;
}

export const changePasswordConfirmationTemplate = ({
  name,
}: ChangePasswordConfirmationProps): string => {
  const content = `
    <p style="margin:0 0 6px;font-size:15px;color:#374151;">
      Hi, <strong style="color:#111827;font-weight:600;">${name}</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      Your account password has been successfully changed. If you made this change, no further action is required.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:#eff6ff;
      border:1.5px solid #bfdbfe;
      border-radius:14px;
      margin-bottom:20px;
    ">
      <tr>
        <td style="padding:24px 20px;text-align:center;">
          <div style="
            width:56px;
            height:56px;
            background:#2563eb;
            border-radius:50%;
            margin:0 auto 14px;
            text-align:center;
            line-height:56px;
            font-size:24px;
            color:#ffffff;
          ">🔒</div>
          <p style="
            margin:0 0 6px;
            font-size:16px;
            font-weight:700;
            color:#1d4ed8;
          ">Password Changed Successfully</p>
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
            Your account is secured with your new password.
          </p>
          <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">
            Changed on <strong style="color:#374151;">${new Date().toUTCString()}</strong>
          </p>
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
                If you did not make this change, your account may be compromised. Please contact our support team immediately.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:#fff7ed;
      border:1px solid #fed7aa;
      border-radius:10px;
    ">
      <tr>
        <td style="padding:12px 14px;">
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;padding-right:10px;">
                <div style="
                  width:18px;height:18px;
                  background:#f97316;
                  border-radius:50%;
                  text-align:center;
                  line-height:18px;
                  font-size:10px;
                  font-weight:700;
                  color:#ffffff;
                ">!</div>
              </td>
              <td style="font-size:12.5px;color:#92400e;line-height:1.55;">
                Never share your password with anyone. We will never ask for your password via phone or chat.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return baseTemplate({
    title: `Password Changed — ${process.env.MAIL_FROM_NAME as string}`,
    content,
  });
};
