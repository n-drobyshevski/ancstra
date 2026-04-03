/**
 * Fix: pnpm + Node.js v24 fails to install @tailwindcss/oxide's optional
 * platform-specific native binding. This script checks if the binding is
 * resolvable and, if not, downloads and extracts it manually.
 *
 * See: https://github.com/npm/cli/issues/4828
 * Remove when pnpm resolves optional native deps correctly on Windows.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const platform = process.platform;
const arch = process.arch;

// Map to Tailwind's package naming — all values are hardcoded constants
const platformMap = {
  'win32-x64': 'oxide-win32-x64-msvc',
  'win32-arm64': 'oxide-win32-arm64-msvc',
  'darwin-x64': 'oxide-darwin-x64',
  'darwin-arm64': 'oxide-darwin-arm64',
  'linux-x64': 'oxide-linux-x64-gnu',
  'linux-arm64': 'oxide-linux-arm64-gnu',
};

const key = `${platform}-${arch}`;
const pkgSuffix = platformMap[key];
if (!pkgSuffix) process.exit(0);

const pkgName = `@tailwindcss/${pkgSuffix}`;

// Check if it already resolves
try {
  require.resolve(pkgName);
  process.exit(0);
} catch {
  // Not resolvable — need to fix
}

// Get the version from the installed @tailwindcss/oxide package
let version;
try {
  const oxidePkgPath = join(process.cwd(), 'node_modules', '@tailwindcss', 'oxide', 'package.json');
  const pkg = require(oxidePkgPath);
  version = pkg.optionalDependencies?.[pkgName] || pkg.version;
} catch {
  process.exit(0);
}

// Validate version format (digits and dots only) as a safety check
if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.log(`[fix-tailwind-oxide] Unexpected version format: ${version}`);
  process.exit(0);
}

console.log(`[fix-tailwind-oxide] Installing ${pkgName}@${version}...`);

const targetDir = join(process.cwd(), 'node_modules', '@tailwindcss', pkgSuffix);
const tarball = `tailwindcss-${pkgSuffix}-${version}.tgz`;
const targetDirPosix = targetDir.replace(/\\/g, '/');

try {
  // All values below are derived from hardcoded platformMap + validated semver version
  execSync(`npm pack ${pkgName}@${version} --pack-destination .`, { stdio: 'pipe' });

  if (!existsSync(tarball)) {
    console.log(`[fix-tailwind-oxide] Failed to download ${tarball}`);
    process.exit(0);
  }

  mkdirSync(targetDir, { recursive: true });
  execSync(`tar xzf ${tarball} -C "${targetDirPosix}" --strip-components=1`, { stdio: 'pipe' });
  unlinkSync(tarball);

  console.log(`[fix-tailwind-oxide] ${pkgName}@${version} installed successfully`);
} catch (err) {
  // Non-fatal — don't block install
  console.log(`[fix-tailwind-oxide] Failed: ${err.message}`);
  try { unlinkSync(tarball); } catch { /* ignore */ }
  process.exit(0);
}
