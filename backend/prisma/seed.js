require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding DbNex database...');

  // Create default organization
  const org = await prisma.organization.upsert({
    where: { slug: 'vayunex-solution' },
    update: {},
    create: {
      name: 'Vayunex Solution',
      slug: 'vayunex-solution',
      plan: 'PRO',
    },
  });

  console.log(`✅ Organization created: ${org.name}`);

  // Create default admin user
  const hashedPassword = await bcrypt.hash('yash00725', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'vayunexsolution@gmail.com' },
    update: {},
    create: {
      organizationId: org.id,
      email: 'vayunexsolution@gmail.com',
      passwordHash: hashedPassword,
      firstName: 'DbNex',
      lastName: 'Admin',
      role: 'OWNER',
      emailVerified: true,
    },
  });

  console.log(`✅ Admin user created: ${admin.email}`);
  console.log('\n🎉 Seeding complete!');
  console.log('──────────────────────────────────');
  console.log(`   Email   : vayunexsolution@gmail.com`);
  console.log(`   Password: yash00725`);
  console.log('   ⚠️  Please change the password immediately after first login!');
  console.log('──────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
