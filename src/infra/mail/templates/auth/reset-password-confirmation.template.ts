import { baseTemplate } from '../base.template';

interface ResetPasswordConfirmationProps {
  name: string;
}

export const resetPasswordConfirmationTemplate = ({
  name,
}: ResetPasswordConfirmationProps): string => {
  const content = `
    <p style="margin:0 0 6px;font-size:15px;color:#374151;">
      Hi, <strong style="color:#111827;font-weight:600;">${name}</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      Your password has been successfully reset. You can now log in with your new password.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:#f0fdf4;
      border:1.5px solid #bbf7d0;
      border-radius:14px;
      margin-bottom:20px;
    ">
      <tr>
        <td style="padding:24px 20px;text-align:center;">
          <div style="
            width:56px;
            height:56px;
            background:#16a34a;
            border-radius:50%;
            margin:0 auto 14px;
            text-align:center;
            line-height:56px;
            font-size:26px;
            color:#ffffff;
          ">✓</div>
          <p style="
            margin:0 0 6px;
            font-size:16px;
            font-weight:700;
            color:#15803d;
          ">Password Reset Successful</p>
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
            Your account is now secured with your new password.
          </p>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:#fff7ed;
      border:1px solid #fed7aa;
      border-radius:10px;
      margin-bottom:20px;
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
                If you did not reset your password, please contact our support team immediately and secure your account.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="text-align:center;padding-top:4px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            For security, this change was made on
            <strong style="color:#374151;">${new Date().toUTCString()}</strong>
          </p>
        </td>
      </tr>
    </table>
  `;

  return baseTemplate({
    title: `Password Reset Confirmation — ${process.env.MAIL_FROM_NAME as string}`,
    content,
  });
};
