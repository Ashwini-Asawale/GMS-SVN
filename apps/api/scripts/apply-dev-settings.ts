import '../src/load-env.js';
import { ensureDatabaseUrl } from '../src/load-env.js';
import { syncDevRepositoriesFromDisk } from '../src/services/dev-repo-sync.js';
import { syncSeedSvnPasswd } from '../src/services/svn-passwd-sync.js';
import { upsertPlatformSettings } from '../src/lib/platform-settings.js';
import { ensureDefaultTenant } from '../src/lib/tenant.js';

ensureDatabaseUrl();

const serverHost = process.argv[2] ?? process.env.GMS_SVN_SERVER_HOST ?? '192.168.1.133';
const svnPort = process.env.SVN_PORT ?? '3690';
const svnUrl =
  process.argv[3] ??
  process.env.VISUALSVN_URL ??
  `svn://${serverHost}:${svnPort}`;
const repoRoot = process.argv[4] ?? process.env.VISUALSVN_REPO_ROOT ?? 'D:\\GMS-SVN\\.dev-svn-repos';

async function main() {
  const tenant = await ensureDefaultTenant();

  await upsertPlatformSettings(tenant.id, {
    gmsSvnServerHost: serverHost,
    visualsvnUrl: svnUrl,
    visualsvnRepoRoot: repoRoot,
  });

  const { synced, names } = await syncDevRepositoriesFromDisk({
    tenantId: tenant.id,
    repoRoot,
    svnUrl,
  });
  console.log(`Registered ${synced} repositories: ${names.join(', ') || '(none)'}`);
  syncSeedSvnPasswd(repoRoot);
  console.log('Synced SVN passwd for seed users (admin, dev1, dev2)');

  console.log('Settings updated:');
  console.log(`  tenant = ${tenant.slug}`);
  console.log(`  gms_svn.server_host = ${serverHost}`);
  console.log(`  visualsvn.url = ${svnUrl}`);
  console.log(`  visualsvn.repo_root = ${repoRoot}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
