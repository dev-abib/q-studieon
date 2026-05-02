import { baseTemplate } from '../base.template';
import { OTPEmailProps } from '../template.type';

export const resetPasswordTemplate = ({ name, otp }: OTPEmailProps): string => {
  const digits = otp
    .toString()
    .split('')
    .map(
      (d) => `
      <td style="padding:0 4px;">
        <div style="
          width:48px;
          height:58px;
          background:#fdf4ff;
          border:1.5px solid #e9d5ff;
          border-radius:10px;
          text-align:center;
          line-height:58px;
          font-size:26px;
          font-weight:700;
          color:#111827;
          font-family:'Courier New',monospace;
        ">${d}</div>
      </td>`,
    )
    .join('');

  const content = `
    <p style="margin:0 0 6px;font-size:15px;color:#374151;">
      Hi, <strong style="color:#111827;font-weight:600;">${name}</strong>
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
      We received a request to reset your password. Use the one-time password below to proceed.
      If you did not request this, you can safely ignore this email.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:#fdf4ff;
      border:1.5px dashed #d8b4fe;
      border-radius:14px;
      margin-bottom:20px;
    ">
      <tr>
        <td style="padding:24px 20px;text-align:center;">
          <p style="
            margin:0 0 12px;
            font-size:11px;
            font-weight:600;
            color:#7c3aed;
            letter-spacing:1.2px;
            text-transform:uppercase;
          ">Your password reset code</p>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
            <tr>${digits}</tr>
          </table>
          <p style="margin:0;font-size:12px;color:#6b7280;">
            Expires in <strong style="color:#374151;">10 minutes</strong>
          </p>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background:#fff7ed;
      border:1px solid #fed7aa;
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
                Never share this code with anyone. We will never ask for your OTP via phone or chat.
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
                If you did not request a password reset, please secure your account immediately by changing your password.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return baseTemplate({
    title: `${'Reset Your Password'} ${process.env.MAIL_FROM_NAME as string}`,
    content,
  });
};
