import * as fs from 'fs';
import * as path from 'path';
import plist from 'simple-plist';
import { validTypesForReaper } from './findTypes.js';

export function safelyParsePlist(contents: Buffer): any {
  try {
    return plist.parse(contents, undefined);
  } catch (error) {
    const stringFile = contents.toString();
    const trimmedFile = stringFile.trim();
    return plist.parse(trimmedFile, undefined);
  }
}

function getExecutablePaths(appPath: string): string[] {
  const executables: string[] = [];

  const infoPlistPath = path.join(appPath, 'Info.plist');
  if (!fs.existsSync(infoPlistPath)) {
    throw new Error(`Info.plist not found at ${infoPlistPath}`);
  }

  const infoPlistContent = fs.readFileSync(infoPlistPath);
  const info = safelyParsePlist(infoPlistContent) as { CFBundleExecutable?: string };

  if (info.CFBundleExecutable) {
    const execPath = path.join(appPath, info.CFBundleExecutable);
    if (fs.existsSync(execPath)) {
      executables.push(execPath);
    }
  }

  const frameworksDir = path.join(appPath, 'Frameworks');
  if (fs.existsSync(frameworksDir)) {
    const entries = fs.readdirSync(frameworksDir);
    for (const entry of entries) {
      if (entry.endsWith('.framework')) {
        const frameworkPath = path.join(frameworksDir, entry);
        const frameworkInfoPlist = path.join(frameworkPath, 'Info.plist');
        if (fs.existsSync(frameworkInfoPlist)) {
          const plistContent = fs.readFileSync(frameworkInfoPlist);
          const frameworkInfo = safelyParsePlist(plistContent) as { CFBundleExecutable?: string };
          if (frameworkInfo.CFBundleExecutable) {
            const frameworkExecPath = path.join(frameworkPath, frameworkInfo.CFBundleExecutable);
            if (fs.existsSync(frameworkExecPath)) {
              executables.push(frameworkExecPath);
            }
          }
        }
      }
    }
  }

  return executables;
}


const args = process.argv.slice(2);
if (args.length != 2) {
  console.error('Expected exactly two arguments, the path to a .app and the output file path.');
  process.exit(1);
}

const appPath = args[0];
const outputFile = args[1];
const allTypes: string[] = []
const executablePaths = getExecutablePaths(appPath);
for (const path of executablePaths) {
  const data = fs.readFileSync(path);
  allTypes.push(...validTypesForReaper(data));
}
const output = JSON.stringify(allTypes);
fs.writeFileSync(outputFile, output, 'utf-8');
