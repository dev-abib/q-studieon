// src/infra/emails/templates/base.template.ts

import { BaseEmailProps } from './template.type';

export const baseTemplate = ({ title, content }: BaseEmailProps): string => {
  const year = new Date().getFullYear();
  const siteName = (process.env.MAIL_FROM_NAME as string) ?? 'Q Studieon';
  const siteUrl = process.env.SITE_URL ?? '#';

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
      <tr>
        <td align="center">
          <table width="520" cellpadding="0" cellspacing="0" style="
            background:#ffffff;
            border-radius:20px;
            overflow:hidden;
            border:1px solid #e2e5ea;
          ">
            <tr>
              <td style="background:#0a0a0a;padding:28px 32px 26px;">
                <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                  <tr>
                    <td style="
                      width:34px;height:34px;
                      background:#16a34a;
                      border-radius:9px;
                      text-align:center;
                      vertical-align:middle;
                      font-size:16px;
                      font-weight:700;
                      color:#ffffff;
                    ">q</td>
                    <td style="
                      padding-left:10px;
                      font-size:15px;
                      font-weight:500;
                      color:#ffffff;
                      letter-spacing:0.2px;
                      vertical-align:middle;
                    ">${siteName}</td>
                  </tr>
                </table>
                <h1 style="
                  margin:0;
                  color:#ffffff;
                  font-size:24px;
                  font-weight:700;
                  letter-spacing:-0.4px;
                  line-height:1.2;
                ">${title}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 28px;font-size:14px;color:#374151;line-height:1.75;">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e5e7eb;">
                <table width="100%" cellpadding="0" cellspacing="0" style="padding:16px 32px;">
                  <tr>
                    <td style="font-size:12px;color:#9ca3af;">
                      &copy; ${year} ${siteName} Inc.
                    </td>
                    <td align="right">
                      <a href="${siteUrl}/unsubscribe" style="font-size:11px;color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
                      <a href="${siteUrl}/privacy" style="font-size:11px;color:#9ca3af;margin-left:16px;text-decoration:underline;">Privacy</a>
                      <a href="${siteUrl}/help" style="font-size:11px;color:#9ca3af;margin-left:16px;text-decoration:underline;">Help</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <p style="margin-top:14px;font-size:11px;color:#9ca3af;">
            This is an automated email. Please do not reply.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
};
