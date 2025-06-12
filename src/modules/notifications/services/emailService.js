
import nodemailer from 'nodemailer';
import logger from '../../../config/logger.js';

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

export const sendEmail = async (to, subject, html, attachments = []) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Rental Management System" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error('Error sending email:', error);
    throw error;
  }
};

export const sendWelcomeEmail = async (email, role, password = null) => {
  const subject = 'Welcome to Rental Management System';
  
  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Welcome to Rental Management System!</h2>
      <p>Your account has been created successfully.</p>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Account Details:</h3>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Role:</strong> ${role}</p>
        ${password ? `<p><strong>Temporary Password:</strong> ${password}</p>` : ''}
      </div>
      ${password ? '<p><strong>Important:</strong> Please change your password after your first login for security purposes.</p>' : ''}
      <p>Thank you for joining our platform!</p>
      <hr style="margin: 30px 0;">
      <p style="font-size: 12px; color: #666;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  `;

  return sendEmail(email, subject, html);
};

export const sendPaymentReminderEmail = async (email, tenantName, amount, dueDate) => {
  const subject = 'Payment Reminder - Rental Management System';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">Payment Reminder</h2>
      <p>Dear ${tenantName},</p>
      <p>This is a friendly reminder that your rent payment is due.</p>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Payment Details:</h3>
        <p><strong>Amount Due:</strong> $${amount}</p>
        <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
      </div>
      <p>Please ensure your payment is made on time to avoid any late fees.</p>
      <p>If you have any questions, please contact your property manager.</p>
      <hr style="margin: 30px 0;">
      <p style="font-size: 12px; color: #666;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  `;

  return sendEmail(email, subject, html);
};

export const sendPaymentConfirmationEmail = async (email, tenantName, amount, receiptUrl) => {
  const subject = 'Payment Confirmation - Rental Management System';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #27ae60;">Payment Confirmed</h2>
      <p>Dear ${tenantName},</p>
      <p>We have successfully received your payment. Thank you!</p>
      <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Payment Details:</h3>
        <p><strong>Amount Paid:</strong> $${amount}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div>
      ${receiptUrl ? `<p><a href="${receiptUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Download Receipt</a></p>` : ''}
      <p>Thank you for your timely payment!</p>
      <hr style="margin: 30px 0;">
      <p style="font-size: 12px; color: #666;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  `;

  return sendEmail(email, subject, html);
};

export const sendLeaseExpiryEmail = async (email, tenantName, propertyName, expiryDate) => {
  const subject = 'Lease Expiry Notice - Rental Management System';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f39c12;">Lease Expiry Notice</h2>
      <p>Dear ${tenantName},</p>
      <p>This is to inform you that your lease is approaching its expiry date.</p>
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Lease Details:</h3>
        <p><strong>Property:</strong> ${propertyName}</p>
        <p><strong>Expiry Date:</strong> ${new Date(expiryDate).toLocaleDateString()}</p>
      </div>
      <p>Please contact your property manager to discuss lease renewal or move-out procedures.</p>
      <hr style="margin: 30px 0;">
      <p style="font-size: 12px; color: #666;">
        This is an automated email. Please do not reply to this message.
      </p>
    </div>
  `;

  return sendEmail(email, subject, html);
};

export const sendOwnerAlertEmail = async (email, ownerName, subject, message) => {
  const emailSubject = `Alert: ${subject}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc3545;">Property Alert</h2>
      <p>Dear ${ownerName},</p>
      <div style="background-color: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>${subject}</h3>
        <p>${message}</p>
      </div>
      <p>Please review this alert and take appropriate action if necessary.</p>
      <hr style="margin: 30px 0;">
      <p style="font-size: 12px; color: #666;">
        This is an automated email from the Rental Management System.
      </p>
    </div>
  `;

  return sendEmail(email, emailSubject, html);
};
