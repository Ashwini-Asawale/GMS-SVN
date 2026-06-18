import '../src/load-env.js';

import { ensureDatabaseUrl } from '../src/load-env.js';

import { PrismaClient } from '@prisma/client';

import { syncDevRepositoriesFromDisk } from '../src/services/dev-repo-sync.js';
import { syncSeedSvnPasswd } from '../src/services/svn-passwd-sync.js';



ensureDatabaseUrl();



const serverHost = process.argv[2] ?? '192.168.1.133';

const svnUrl = process.argv[3] ?? 'svn://192.168.1.133:3690';

const repoRoot = process.argv[4] ?? 'D:\\GMS-SVN\\.dev-svn-repos';



const prisma = new PrismaClient();



async function main() {

  const upsert = (key: string, value: string) =>

    prisma.platformSetting.upsert({

      where: { key },

      create: { key, value },

      update: { value },

    });



  await upsert('gms_svn.server_host', serverHost);

  await upsert('visualsvn.url', svnUrl);

  await upsert('visualsvn.repo_root', repoRoot);



  const { synced, names } = await syncDevRepositoriesFromDisk({ repoRoot, svnUrl });

  console.log(`Registered ${synced} repositories: ${names.join(', ') || '(none)'}`);
  syncSeedSvnPasswd(repoRoot);
  console.log('Synced SVN passwd for seed users (admin, dev1, dev2)');



  console.log('Settings updated:');

  console.log(`  gms_svn.server_host = ${serverHost}`);

  console.log(`  visualsvn.url = ${svnUrl}`);

  console.log(`  visualsvn.repo_root = ${repoRoot}`);

}



main()

  .catch((e) => {

    console.error(e);

    process.exit(1);

  })

  .finally(() => prisma.$disconnect());


