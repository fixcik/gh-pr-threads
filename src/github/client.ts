import { execSync } from 'child_process';

export function runGh(args: string[]): any {
  try {
    const command = `gh ${args.join(' ')}`;
    const output = execSync(command, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(output);
  } catch (error: any) {
    console.error(`Error running gh command: ${error.message}`);
    process.exit(1);
  }
}
