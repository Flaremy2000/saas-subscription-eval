import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter });

const COMPANY_NAME = 'Acme Corporation';

async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const company = await prisma.company.upsert({
    where: { name: COMPANY_NAME },
    update: {},
    create: {
      name: COMPANY_NAME,
      apiLimit: 100_000,
      licenseLimit: 25,
    },
  });

  const seedUsers = [
    { email: 'admin@empresa.com', name: 'Ana Admin', role: 'ADMIN' as const, licensed: true },
    { email: 'usuario@empresa.com', name: 'Luis User', role: 'USER' as const, licensed: true },
    {
      email: 'maria.garcia@empresa.com',
      name: 'Maria Garcia',
      role: 'USER' as const,
      licensed: true,
    },
    {
      email: 'carlos.lopez@empresa.com',
      name: 'Carlos Lopez',
      role: 'USER' as const,
      licensed: true,
    },
    {
      email: 'sofia.martinez@empresa.com',
      name: 'Sofia Martinez',
      role: 'USER' as const,
      licensed: true,
    },
    { email: 'jorge.ruiz@empresa.com', name: 'Jorge Ruiz', role: 'USER' as const, licensed: true },
    {
      email: 'laura.torres@empresa.com',
      name: 'Laura Torres',
      role: 'USER' as const,
      licensed: true,
    },
    {
      email: 'diego.ramos@empresa.com',
      name: 'Diego Ramos',
      role: 'USER' as const,
      licensed: false,
    },
    {
      email: 'elena.vargas@empresa.com',
      name: 'Elena Vargas',
      role: 'USER' as const,
      licensed: true,
    },
    {
      email: 'pablo.mendoza@empresa.com',
      name: 'Pablo Mendoza',
      role: 'USER' as const,
      licensed: false,
    },
  ];

  const users = [];
  for (const u of seedUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        companyId: company.id,
      },
    });
    users.push({ ...user, licensed: u.licensed });
  }

  for (const user of users) {
    if (!user.licensed) continue;
    const existing = await prisma.license.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
    });
    if (existing) continue;
    await prisma.license.create({
      data: {
        userId: user.id,
        companyId: company.id,
        status: 'ACTIVE',
      },
    });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    const trend = 29 - i;
    const weekday = date.getUTCDay();
    const base = 2400 + trend * 35 + (weekday === 0 || weekday === 6 ? -700 : 0);
    const apiCalls = Math.max(0, base + ((i * 137) % 400) - 200);

    await prisma.usageMetric.upsert({
      where: { companyId_date: { companyId: company.id, date } },
      update: { apiCalls },
      create: {
        id: randomUUID(),
        companyId: company.id,
        date,
        apiCalls,
      },
    });
  }

  for (const user of users) {
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() - i);
      const weekday = date.getUTCDay();
      const personal =
        weekday === 0 || weekday === 6 ? 0 : 60 + ((user.email.length * 7 + i * 53) % 340);

      await prisma.userUsageMetric.upsert({
        where: {
          companyId_userId_date: { companyId: company.id, userId: user.id, date },
        },
        update: { apiCalls: personal },
        create: {
          id: randomUUID(),
          companyId: company.id,
          userId: user.id,
          date,
          apiCalls: personal,
        },
      });
    }
  }

  const usage = await prisma.usageMetric.aggregate({
    where: { companyId: company.id },
    _sum: { apiCalls: true },
  });
  const activeLicenses = await prisma.license.count({
    where: { companyId: company.id, status: 'ACTIVE' },
  });

  console.log('Seed completed:');
  console.log(`  Company: ${company.name} (id=${company.id})`);
  console.log(`  Users: ${users.length}`);
  console.log(`  Active licenses: ${activeLicenses}/${company.licenseLimit}`);
  console.log(`  Usage (30d): ${usage._sum.apiCalls}/${company.apiLimit} API calls`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
