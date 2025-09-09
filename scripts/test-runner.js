#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader(title) {
  console.log('\n' + '='.repeat(60));
  console.log(colorize(title, 'cyan'));
  console.log('='.repeat(60));
}

function printSection(title) {
  console.log('\n' + colorize(title, 'yellow'));
  console.log('-'.repeat(40));
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function runTests() {
  try {
    printHeader('🧪 Node Tracker - Test Suite Runner');

    // Check if Jest is installed
    try {
      await runCommand('npx', ['jest', '--version'], { stdio: 'pipe' });
    } catch (error) {
      console.error(colorize('❌ Jest is not installed. Please run: npm install', 'red'));
      process.exit(1);
    }

    // Run different test suites for RESTful API
    const testSuites = [
      {
        name: '🔐 Auth Module Tests - Service',
        command: 'npx',
        args: ['jest', 'src/auth/__tests__/auth.service.test.js', '--verbose']
      },
      {
        name: '🔐 Auth Module Tests - Router',
        command: 'npx',
        args: ['jest', 'src/auth/__tests__/auth.router.test.js', '--verbose']
      },
      {
        name: '👥 Users Module Tests - Service',
        command: 'npx',
        args: ['jest', 'src/users/__tests__/users.service.test.js', '--verbose']
      },
      {
        name: '👥 Users Module Tests - Router',
        command: 'npx',
        args: ['jest', 'src/users/__tests__/users.router.test.js', '--verbose']
      },
      {
        name: '📁 Torrents Module Tests - Service',
        command: 'npx',
        args: ['jest', 'src/torrents/__tests__/torrents.service.test.js', '--verbose']
      },
      {
        name: '📁 Torrents Module Tests - Router',
        command: 'npx',
        args: ['jest', 'src/torrents/__tests__/torrents.router.test.js', '--verbose']
      },
      {
        name: '🚫 IP Bans Module Tests - Service',
        command: 'npx',
        args: ['jest', 'src/ip-bans/__tests__/ip-bans.service.test.js', '--verbose']
      },
      {
        name: '🚫 IP Bans Module Tests - Router',
        command: 'npx',
        args: ['jest', 'src/ip-bans/__tests__/ip-bans.router.test.js', '--verbose']
      },
      {
        name: '📧 Invitations Module Tests - Service',
        command: 'npx',
        args: ['jest', 'src/invitations/__tests__/invitations.service.test.js', '--verbose']
      },
      {
        name: '📧 Invitations Module Tests - Router',
        command: 'npx',
        args: ['jest', 'src/invitations/__tests__/invitations.router.test.js', '--verbose']
      },
      {
        name: '🔐 Auth Middleware Tests',
        command: 'npx',
        args: ['jest', 'src/middleware/__tests__/auth.test.js', '--verbose']
      },
      {
        name: '🛠️ Utils Tests',
        command: 'npx',
        args: ['jest', 'src/utils/__tests__/utils.test.js', '--verbose']
      },
      {
        name: '🔗 Integration Tests - RESTful API',
        command: 'npx',
        args: ['jest', 'src/__tests__/integration.test.js', '--verbose']
      }
    ];

    let passedSuites = 0;
    let failedSuites = 0;

    for (const suite of testSuites) {
      printSection(suite.name);
      try {
        await runCommand(suite.command, suite.args);
        console.log(colorize(`✅ ${suite.name} - PASSED`, 'green'));
        passedSuites++;
      } catch (error) {
        console.log(colorize(`❌ ${suite.name} - FAILED`, 'red'));
        failedSuites++;
      }
    }

    // Run coverage report
    printSection('📊 Coverage Report');
    try {
      await runCommand('npx', ['jest', '--coverage', '--silent']);
      console.log(colorize('✅ Coverage report generated', 'green'));
    } catch (error) {
      console.log(colorize('❌ Coverage report failed', 'red'));
    }

    // Summary
    printHeader('📋 Test Summary');
    console.log(`${colorize('Passed:', 'green')} ${passedSuites} test suites`);
    console.log(`${colorize('Failed:', 'red')} ${failedSuites} test suites`);
    console.log(`${colorize('Total:', 'blue')} ${passedSuites + failedSuites} test suites`);

    if (failedSuites === 0) {
      console.log(colorize('\n🎉 All tests passed!', 'green'));
      process.exit(0);
    } else {
      console.log(colorize('\n💥 Some tests failed!', 'red'));
      process.exit(1);
    }

  } catch (error) {
    console.error(colorize(`❌ Test runner failed: ${error.message}`, 'red'));
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${colorize('RESTful BitTorrent Tracker - Test Runner', 'cyan')}

Usage: node test-runner.js [options]

${colorize('RESTful API Modules Tested:', 'yellow')}
  🔐 auth         - Authentication (register/login)
  👥 users        - User management (CRUD)
  📁 torrents     - Torrent management (CRUD)
  🚫 ip-bans      - IP ban management (CRUD)
  📧 invitations  - Invitation system (CRUD)
  🔐 middleware   - Authentication middleware
  🛠️ utils        - Utility functions
  🔗 integration  - Full API integration tests

${colorize('Options:', 'yellow')}
  --help, -h     Show this help message
  --watch, -w    Run tests in watch mode
  --coverage, -c Run only coverage report
  --unit, -u     Run only unit tests
  --integration, -i Run only integration tests

${colorize('Examples:', 'yellow')}
  node test-runner.js           # Run all RESTful API tests
  node test-runner.js --watch   # Run tests in watch mode
  node test-runner.js --unit    # Run only unit tests
  node test-runner.js --coverage # Generate coverage report
  `);
  process.exit(0);
}

if (args.includes('--watch') || args.includes('-w')) {
  console.log(colorize('🔄 Running tests in watch mode...', 'yellow'));
  runCommand('npx', ['jest', '--watch']).catch(() => process.exit(1));
} else if (args.includes('--coverage') || args.includes('-c')) {
  console.log(colorize('📊 Running coverage report...', 'yellow'));
  runCommand('npx', ['jest', '--coverage']).catch(() => process.exit(1));
} else if (args.includes('--unit') || args.includes('-u')) {
  console.log(colorize('🔧 Running unit tests only...', 'yellow'));
  runCommand('npx', ['jest', '--testPathIgnorePatterns=integration']).catch(() => process.exit(1));
} else if (args.includes('--integration') || args.includes('-i')) {
  console.log(colorize('🔗 Running integration tests only...', 'yellow'));
  runCommand('npx', ['jest', 'integration.test.js']).catch(() => process.exit(1));
} else {
  runTests();
}