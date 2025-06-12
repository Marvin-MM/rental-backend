
import PDFDocument from 'pdfkit';
import logger from '../config/logger.js';

/**
 * Generate payment receipt PDF
 * @param {Object} data - Receipt data
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generatePaymentReceipt = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Header
      doc.fontSize(20).text('PAYMENT RECEIPT', { align: 'center' });
      doc.moveDown();

      // Company info
      if (data.owner.companyName) {
        doc.fontSize(16).text(data.owner.companyName, { align: 'center' });
      }
      doc.fontSize(12).text(`Property Management Services`, { align: 'center' });
      doc.moveDown(2);

      // Receipt details
      doc.fontSize(14).text('Receipt Details', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(12);
      doc.text(`Receipt Number: RCP-${data.payment.id.substring(0, 8).toUpperCase()}`);
      doc.text(`Date Paid: ${new Date(data.payment.paidDate).toLocaleDateString()}`);
      doc.text(`Payment Method: ${data.payment.method}`);
      if (data.payment.transactionId) {
        doc.text(`Transaction ID: ${data.payment.transactionId}`);
      }
      doc.moveDown();

      // Tenant information
      doc.fontSize(14).text('Tenant Information', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(12);
      doc.text(`Name: ${data.tenant.firstName} ${data.tenant.lastName}`);
      doc.text(`Email: ${data.tenant.user.email}`);
      if (data.tenant.phone) {
        doc.text(`Phone: ${data.tenant.phone}`);
      }
      doc.moveDown();

      // Property information
      doc.fontSize(14).text('Property Information', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(12);
      doc.text(`Property: ${data.property.name}`);
      doc.text(`Address: ${data.property.address}`);
      doc.moveDown();

      // Payment information
      doc.fontSize(14).text('Payment Information', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(12);
      doc.text(`Due Date: ${new Date(data.payment.dueDate).toLocaleDateString()}`);
      doc.fontSize(16).text(`Amount Paid: $${parseFloat(data.payment.amount).toFixed(2)}`, { 
        align: 'right',
        continued: false
      });

      if (data.payment.notes) {
        doc.moveDown();
        doc.fontSize(12).text(`Notes: ${data.payment.notes}`);
      }

      // Footer
      doc.moveDown(3);
      doc.fontSize(10).text('Thank you for your payment!', { align: 'center' });
      doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

      // Add a border
      doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).stroke();

      doc.end();
    } catch (error) {
      logger.error('Error generating PDF receipt:', error);
      reject(error);
    }
  });
};

/**
 * Generate lease agreement PDF
 * @param {Object} data - Lease data
 * @returns {Promise<Buffer>} - PDF buffer
 */
export const generateLeaseAgreement = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Header
      doc.fontSize(20).text('LEASE AGREEMENT', { align: 'center' });
      doc.moveDown(2);

      // Agreement details
      doc.fontSize(14).text('Agreement Details', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(12);
      doc.text(`Lease ID: ${data.lease.id}`);
      doc.text(`Start Date: ${new Date(data.lease.startDate).toLocaleDateString()}`);
      doc.text(`End Date: ${new Date(data.lease.endDate).toLocaleDateString()}`);
      doc.text(`Monthly Rent: $${parseFloat(data.lease.rentAmount).toFixed(2)}`);
      if (data.lease.securityDeposit) {
        doc.text(`Security Deposit: $${parseFloat(data.lease.securityDeposit).toFixed(2)}`);
      }
      doc.moveDown();

      // Property information
      doc.fontSize(14).text('Property Information', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(12);
      doc.text(`Property: ${data.property.name}`);
      doc.text(`Address: ${data.property.address}`);
      doc.text(`Type: ${data.property.type}`);
      doc.moveDown();

      // Landlord information
      doc.fontSize(14).text('Landlord Information', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(12);
      if (data.owner.companyName) {
        doc.text(`Company: ${data.owner.companyName}`);
      }
      doc.text(`Email: ${data.owner.user.email}`);
      if (data.owner.phone) {
        doc.text(`Phone: ${data.owner.phone}`);
      }
      doc.moveDown();

      // Tenant information
      doc.fontSize(14).text('Tenant Information', { underline: true });
      doc.moveDown(0.5);

      doc.fontSize(12);
      doc.text(`Name: ${data.tenant.firstName} ${data.tenant.lastName}`);
      doc.text(`Email: ${data.tenant.user.email}`);
      if (data.tenant.phone) {
        doc.text(`Phone: ${data.tenant.phone}`);
      }
      doc.moveDown();

      // Terms and conditions
      if (data.lease.terms) {
        doc.fontSize(14).text('Terms and Conditions', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).text(JSON.stringify(data.lease.terms, null, 2));
        doc.moveDown();
      }

      // Signature section
      doc.addPage();
      doc.fontSize(14).text('Signatures', { underline: true });
      doc.moveDown(2);

      doc.fontSize(12);
      doc.text('Landlord Signature: ________________________    Date: ____________');
      doc.moveDown(2);
      doc.text('Tenant Signature: ________________________    Date: ____________');

      // Footer
      doc.moveDown(3);
      doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

      doc.end();
    } catch (error) {
      logger.error('Error generating lease agreement PDF:', error);
      reject(error);
    }
  });
};

export default {
  generatePaymentReceipt,
  generateLeaseAgreement,
};
