"""Branded HTML email fragments shared by inline (non-Resend-template) sends.

Visual language matches the Resend contact templates: light outer canvas,
dark purple card, gold accents, Georgia display type.
"""

from __future__ import annotations

from html import escape


def branded_email(*, preheader: str, inner_html: str, footer_html: str = "") -> str:
    """Wrap inner content in the Debra Wylde email chrome."""
    pre = escape(preheader)
    footer = footer_html or (
        '<p style="margin:0;padding:0;font-size:11px;line-height:1.6;color:#8F839F;">'
        "Debra Wylde &middot; Leadership &middot; Wealth &middot; Impact"
        "</p>"
    )
    return f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no" />
    <title>Debra Wylde</title>
  </head>
  <body style="margin:0;padding:0;background-color:#eeeaf2;width:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{pre}</div>
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:0;padding:0;background-color:#eeeaf2;width:100%;">
      <tr>
        <td align="center" style="padding:40px 16px;background-color:#eeeaf2;">
          <!--[if mso]>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="640" align="center"><tr><td>
          <![endif]-->
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="640" style="width:100%;max-width:640px;margin:0 auto;background-color:#1F0B37;border:1px solid #5a4570;border-radius:24px;overflow:hidden;">
            <tr>
              <td align="center" bgcolor="#1F0B37" style="padding:36px 32px 24px;text-align:center;background-color:#1F0B37;background-image:linear-gradient(135deg,#120526 0%,#1F0B37 45%,#391C59 100%);">
                <p style="margin:0;padding:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;letter-spacing:0.18em;text-transform:uppercase;color:#C6A85A;">Debra Wylde</p>
                <p style="margin:10px 0 0 0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.4;letter-spacing:0.28em;text-transform:uppercase;color:#D87C72;">Leadership &middot; Wealth &middot; Impact</p>
              </td>
            </tr>
            <tr>
              <td bgcolor="#1F0B37" style="padding:0 32px;background-color:#1F0B37;">
                <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td bgcolor="#C6A85A" style="padding:0;height:1px;line-height:1px;font-size:0;background-color:#C6A85A;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="#1F0B37" style="padding:36px 32px 24px;background-color:#1F0B37;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                {inner_html}
              </td>
            </tr>
            <tr>
              <td align="center" bgcolor="#120526" style="padding:24px 32px;background-color:#120526;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                {footer}
              </td>
            </tr>
          </table>
          <!--[if mso]>
          </td></tr></table>
          <![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>"""


def email_button(*, href: str, label: str) -> str:
    """Gold pill CTA button (email-safe table markup)."""
    safe_href = escape(href, quote=True)
    safe_label = escape(label)
    return f"""<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:0 12px 12px 0;display:inline-table;">
  <tr>
    <td align="center" bgcolor="#C6A85A" style="background-color:#C6A85A;border-radius:999px;">
      <a href="{safe_href}" target="_blank" style="display:inline-block;padding:14px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#120526;text-decoration:none;">{safe_label}</a>
    </td>
  </tr>
</table>"""


def email_detail_row(label: str, value_html: str) -> str:
    """Label/value row for internal notification detail tables."""
    return f"""<tr>
  <td width="140" valign="top" style="padding:8px 0;width:140px;font-size:13px;line-height:1.5;color:#B9AFC7;">{escape(label)}</td>
  <td valign="top" style="padding:8px 0;font-size:15px;line-height:1.5;color:#F8F1E8;">{value_html}</td>
</tr>"""
