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
  const hashedPassword = await bcrypt.hash('Admin@DbNex123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@vayunexsolution.com' },
    update: {},
    create: {
      organizationId: org.id,
      email: 'admin@vayunexsolution.com',
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
  console.log(`   Email   : admin@vayunexsolution.com`);
  console.log(`   Password: Admin@DbNex123`);
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
