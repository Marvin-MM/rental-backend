
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create Super Admin
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@rentalmanagement.com' },
    update: {},
    create: {
      email: 'admin@rentalmanagement.com',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Super Admin created:', superAdmin.email);

  // Create Owner
  const ownerUser = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: {
      email: 'owner@example.com',
      password: hashedPassword,
      role: 'OWNER',
      isActive: true,
    },
  });

  const owner = await prisma.owner.upsert({
    where: { userId: ownerUser.id },
    update: {},
    create: {
      userId: ownerUser.id,
      firstName: 'John',
      lastName: 'Owner',
      phone: '+1234567890',
      company: 'ABC Properties LLC',
    },
  });

  console.log('✅ Owner created:', ownerUser.email);

  // Create Manager
  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: {},
    create: {
      email: 'manager@example.com',
      password: hashedPassword,
      role: 'MANAGER',
      isActive: true,
    },
  });

  const manager = await prisma.manager.upsert({
    where: { userId: managerUser.id },
    update: {},
    create: {
      userId: managerUser.id,
      ownerId: owner.id,
      firstName: 'Jane',
      lastName: 'Manager',
      phone: '+1234567891',
    },
  });

  console.log('✅ Manager created:', managerUser.email);

  // Create Tenant
  const tenantUser = await prisma.user.upsert({
    where: { email: 'tenant@example.com' },
    update: {},
    create: {
      email: 'tenant@example.com',
      password: hashedPassword,
      role: 'TENANT',
      isActive: true,
    },
  });

  const tenant = await prisma.tenant.upsert({
    where: { userId: tenantUser.id },
    update: {},
    create: {
      userId: tenantUser.id,
      firstName: 'Bob',
      lastName: 'Tenant',
      phone: '+1234567892',
      dateOfBirth: new Date('1990-01-01'),
      emergencyContact: 'Emergency Contact',
      emergencyPhone: '+1234567893',
    },
  });

  console.log('✅ Tenant created:', tenantUser.email);

  // Create Properties
  const properties = await Promise.all([
    prisma.property.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        ownerId: owner.id,
        name: 'Sunset Apartments',
        description: 'Beautiful apartment complex with modern amenities',
        address: '123 Main Street, City, State 12345',
        type: 'APARTMENT',
        units: 4,
        rentAmount: 1500.00,
        status: 'AVAILABLE',
        amenities: ['Parking', 'Pool', 'Gym', 'Laundry'],
        images: ['https://example.com/image1.jpg'],
      },
    }),
    prisma.property.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        ownerId: owner.id,
        name: 'Ocean View House',
        description: 'Spacious house with ocean view',
        address: '456 Ocean Drive, Coastal City, State 12346',
        type: 'HOUSE',
        units: 1,
        rentAmount: 2500.00,
        status: 'OCCUPIED',
        amenities: ['Garden', 'Garage', 'Ocean View'],
        images: ['https://example.com/image2.jpg'],
      },
    }),
  ]);

  console.log('✅ Properties created:', properties.length);

  // Create Lease
  const lease = await prisma.lease.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: tenant.id,
      propertyId: properties[1].id,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rentAmount: 2500.00,
      securityDeposit: 2500.00,
      status: 'ACTIVE',
      terms: 'Standard lease terms and conditions',
    },
  });

  console.log('✅ Lease created');

  // Create Payments
  const currentDate = new Date();
  const payments = [];

  for (let i = 0; i < 12; i++) {
    const dueDate = new Date(currentDate.getFullYear(), i, 1);
    const isPaid = i < 6; // First 6 months are paid

    const payment = await prisma.payment.create({
      data: {
        tenantId: tenant.id,
        leaseId: lease.id,
        amount: 2500.00,
        dueDate,
        status: isPaid ? 'PAID' : 'PENDING',
        paidDate: isPaid ? new Date(dueDate.getTime() + 24 * 60 * 60 * 1000) : null,
        paymentMethod: isPaid ? 'BANK_TRANSFER' : null,
        description: `Rent payment for ${dueDate.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      },
    });

    payments.push(payment);
  }

  console.log('✅ Payments created:', payments.length);

  // Create Complaints
  const complaints = await Promise.all([
    prisma.complaint.create({
      data: {
        tenantId: tenant.id,
        propertyId: properties[1].id,
        managerId: manager.id,
        title: 'Heating Issue',
        description: 'The heating system is not working properly',
        category: 'MAINTENANCE',
        priority: 'HIGH',
        status: 'OPEN',
      },
    }),
    prisma.complaint.create({
      data: {
        tenantId: tenant.id,
        propertyId: properties[1].id,
        managerId: manager.id,
        title: 'Noise Complaint',
        description: 'Neighbors are too loud during night time',
        category: 'NOISE',
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
      },
    }),
  ]);

  console.log('✅ Complaints created:', complaints.length);

  // Create Notifications
  const notifications = await Promise.all([
    prisma.notification.create({
      data: {
        userId: tenantUser.id,
        title: 'Payment Due Reminder',
        message: 'Your rent payment is due in 3 days',
        type: 'PAYMENT_REMINDER',
        isRead: false,
      },
    }),
    prisma.notification.create({
      data: {
        userId: managerUser.id,
        title: 'New Complaint Assigned',
        message: 'A new complaint has been assigned to you',
        type: 'COMPLAINT_ASSIGNED',
        isRead: false,
      },
    }),
  ]);

  console.log('✅ Notifications created:', notifications.length);

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📧 Default user credentials:');
  console.log('Super Admin: admin@rentalmanagement.com / admin123');
  console.log('Owner: owner@example.com / admin123');
  console.log('Manager: manager@example.com / admin123');
  console.log('Tenant: tenant@example.com / admin123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
