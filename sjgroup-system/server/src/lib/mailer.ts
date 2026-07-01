import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function sendPasswordResetEmail(to: string, name: string, resetLink: string) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? 'Sudijaya Group <noreply@sudijaya.com>',
    to,
    subject: 'Reset Password — Sudijaya Group',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #2563eb; border-radius: 12px; margin-bottom: 12px;">
            <span style="color: #ffffff; font-size: 18px; font-weight: 700;">SJ</span>
          </div>
          <h1 style="margin: 0; font-size: 20px; color: #111827;">Sudijaya Group</h1>
          <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280;">Sistem Manajemen Operasional</p>
        </div>

        <h2 style="font-size: 16px; color: #111827; margin-bottom: 8px;">Halo, ${name}!</h2>
        <p style="font-size: 14px; color: #374151; line-height: 1.6; margin-bottom: 24px;">
          Kami menerima permintaan reset password untuk akun Anda. Klik tombol di bawah ini untuk membuat password baru.
          Tautan ini hanya berlaku selama <strong>1 jam</strong>.
        </p>

        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${resetLink}" style="display: inline-block; padding: 12px 32px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
            Reset Password
          </a>
        </div>

        <p style="font-size: 12px; color: #9ca3af; line-height: 1.6; margin-bottom: 8px;">
          Jika tombol tidak berfungsi, salin dan tempel tautan berikut ke browser Anda:
        </p>
        <p style="font-size: 11px; color: #6b7280; word-break: break-all; background: #f9fafb; padding: 8px 12px; border-radius: 6px; margin-bottom: 24px;">
          ${resetLink}
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin-bottom: 16px;">
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">
          Jika Anda tidak meminta reset password, abaikan email ini. Password Anda tidak akan berubah.
        </p>
      </div>
    `,
  })
}
