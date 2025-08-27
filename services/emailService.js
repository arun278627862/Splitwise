const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransporter({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('Email service configuration error:', error);
      } else {
        console.log('Email service ready');
      }
    });
  }

  async sendEmail(to, subject, html, text = null) {
    try {
      const mailOptions = {
        from: `"Splitwise Clone" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
        text: text || this.stripHtml(html)
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return result;
    } catch (error) {
      console.error('Email sending error:', error);
      throw error;
    }
  }

  async sendVerificationEmail(email, verificationToken, userName) {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your Email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Splitwise Clone!</h1>
          </div>
          <div class="content">
            <h2>Hi ${userName},</h2>
            <p>Thank you for signing up! Please verify your email address to get started with managing your shared expenses.</p>
            <p>Click the button below to verify your email:</p>
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${verificationUrl}">${verificationUrl}</a></p>
            <p>This verification link will expire in 24 hours.</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The Splitwise Clone Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(email, 'Verify Your Email Address', html);
  }

  async sendPasswordResetEmail(email, resetToken, userName) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF6B6B; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { display: inline-block; background: #FF6B6B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${userName},</h2>
            <p>We received a request to reset your password for your Splitwise Clone account.</p>
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
            <p>This password reset link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The Splitwise Clone Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(email, 'Password Reset Request', html);
  }

  async sendGroupInvitation(email, group, inviter) {
    const joinUrl = `${process.env.FRONTEND_URL}/join-group/${group.inviteCode}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Group Invitation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { display: inline-block; background: #2196F3; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .group-info { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're Invited to Join a Group!</h1>
          </div>
          <div class="content">
            <h2>Hi there,</h2>
            <p><strong>${inviter.name}</strong> has invited you to join their expense group on Splitwise Clone.</p>
            
            <div class="group-info">
              <h3>Group Details:</h3>
              <p><strong>Name:</strong> ${group.name}</p>
              ${group.description ? `<p><strong>Description:</strong> ${group.description}</p>` : ''}
              <p><strong>Invite Code:</strong> ${group.inviteCode}</p>
            </div>

            <p>Join the group to start splitting expenses and keeping track of who owes what!</p>
            
            <a href="${joinUrl}" class="button">Join Group</a>
            
            <p>If the button doesn't work, you can:</p>
            <ol>
              <li>Visit <a href="${process.env.FRONTEND_URL}">${process.env.FRONTEND_URL}</a></li>
              <li>Click "Join Group"</li>
              <li>Enter the invite code: <strong>${group.inviteCode}</strong></li>
            </ol>
            
            <p>If you don't have an account yet, you'll be able to create one when you join.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The Splitwise Clone Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(email, `Invitation to join "${group.name}"`, html);
  }

  async sendNotificationEmail(email, notification) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${notification.title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #9C27B0; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .notification { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #9C27B0; }
          .button { display: inline-block; background: #9C27B0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${notification.title}</h1>
          </div>
          <div class="content">
            <div class="notification">
              <p>${notification.message}</p>
              ${notification.data && notification.data.amount ? 
                `<p><strong>Amount:</strong> ${notification.data.amount} ${notification.data.currency || 'USD'}</p>` : 
                ''
              }
            </div>
            
            <a href="${process.env.FRONTEND_URL}" class="button">View in App</a>
            
            <p>Stay on top of your shared expenses with Splitwise Clone!</p>
          </div>
          <div class="footer">
            <p>Best regards,<br>The Splitwise Clone Team</p>
            <p style="font-size: 12px; margin-top: 10px;">
              You're receiving this email because you have notifications enabled. 
              You can change your notification preferences in your account settings.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(email, notification.title, html);
  }

  async sendExpenseReminder(email, userName, expenses) {
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Expense Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .expense-list { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .expense-item { padding: 10px 0; border-bottom: 1px solid #ddd; }
          .button { display: inline-block; background: #FF9800; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { background: #f4f4f4; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Outstanding Balance Reminder</h1>
          </div>
          <div class="content">
            <h2>Hi ${userName},</h2>
            <p>You have outstanding balances that need to be settled:</p>
            
            <div class="expense-list">
              <h3>Outstanding Amounts:</h3>
              ${expenses.map(expense => `
                <div class="expense-item">
                  <strong>${expense.group}</strong>: ${expense.amount} ${expense.currency}
                  <br><small>With: ${expense.otherUser}</small>
                </div>
              `).join('')}
              <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #ddd;">
                <strong>Total: ${totalAmount.toFixed(2)} USD</strong>
              </div>
            </div>
            
            <p>Please settle these amounts to keep your group expenses organized.</p>
            
            <a href="${process.env.FRONTEND_URL}" class="button">View Balances</a>
          </div>
          <div class="footer">
            <p>Best regards,<br>The Splitwise Clone Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(email, 'Outstanding Balance Reminder', html);
  }

  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

module.exports = new EmailService();