import '../src/load-env.js';
import { ensureDatabaseUrl } from '../src/load-env.js';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth.js';
import { seedDefaultPlatformSettings } from '../src/lib/platform-settings.js';
import { syncSeedSvnPasswd } from '../src/services/svn-passwd-sync.js';

ensureDatabaseUrl();
const prisma = new PrismaClient();

async function main() {
  const adminPassword = await hashPassword('admin123');
  const devPassword = await hashPassword('dev123');

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@gms.local',
      passwordHash: adminPassword,
      isAdmin: true,
    },
  });

  const dev1 = await prisma.user.upsert({
    where: { username: 'dev1' },
    update: {},
    create: {
      username: 'dev1',
      email: 'dev1@gms.local',
      passwordHash: devPassword,
      isAdmin: false,
    },
  });

  const dev2 = await prisma.user.upsert({
    where: { username: 'dev2' },
    update: {},
    create: {
      username: 'dev2',
      email: 'dev2@gms.local',
      passwordHash: devPassword,
      isAdmin: false,
    },
  });

  const developers = await prisma.group.upsert({
    where: { name: 'Developers' },
    update: {},
    create: {
      name: 'Developers',
      description: 'Default developer group',
    },
  });

  const admins = await prisma.group.upsert({
    where: { name: 'Administrators' },
    update: {},
    create: {
      name: 'Administrators',
      description: 'Platform administrators',
    },
  });

  for (const [userId, groupId] of [
    [dev1.id, developers.id],
    [dev2.id, developers.id],
    [admin.id, admins.id],
  ] as const) {
    await prisma.groupMember.upsert({
      where: { userId_groupId: { userId, groupId } },
      update: {},
      create: { userId, groupId },
    });
  }

  await seedDefaultPlatformSettings();
  syncSeedSvnPasswd();

  console.log('Seed complete:');
  console.log('  admin / admin123 (isAdmin)');
  console.log('  dev1  / dev123');
  console.log('  dev2  / dev123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
