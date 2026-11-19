// Runs the Haiku classification benchmark (tests/benchmark) against the real
// Claude API.
//
//   npm run test:benchmark -- --api-key sk-ant-...
//   npm run test:benchmark -- --api-key=sk-ant-...
//
// Without --api-key it falls back to the ANTHROPIC_API_KEY environment
// variable. Any other arguments are passed on to Vitest (e.g. -t "Test 2").
// The key goes to the tests through the environment, never the command line
// of a child process, so it does not show up in process listings.
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
let apiKey = process.env.ANTHROPIC_API_KEY;
const passThrough = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--api-key') {
    apiKey = args[++i];
  } else if (arg.startsWith('--api-key=')) {
    apiKey = arg.slice('--api-key='.length);
  } else {
    passThrough.push(arg);
  }
}

if (!apiKey) {
  console.error('Missing API key. Usage: npm run test:benchmark -- --api-key sk-ant-...');
  process.exit(1);
}

const child = spawn('npx', ['vitest', 'run', '--config', 'vitest.benchmark.config.mts', ...passThrough], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, FOCUSGARDEN_BENCHMARK_API_KEY: apiKey },
});
child.on('exit', (code) => process.exit(code ?? 1));
