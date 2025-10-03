#!/usr/bin/env node

/**
 * Enhanced test runner script for the automated testing system
 * Provides advanced test execution capabilities with filtering and targeting
 */

const { spawn } = require('child_process');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Available commands and their configurations
const commands = {
  'unit': {
    description: 'Run unit tests',
    vitestArgs: ['run', 'tests/unit']
  },
  'integration': {
    description: 'Run integration tests',
    vitestArgs: ['run', 'tests/integration']
  },
  'e2e': {
    description: 'Run end-to-end tests',
    vitestArgs: ['run', 'tests/e2e']
  },
  'all': {
    description: 'Run all tests',
    vitestArgs: ['run']
  },
  'coverage': {
    description: 'Run all tests with coverage',
    vitestArgs: ['run', '--coverage']
  },
  'watch': {
    description: 'Run tests in watch mode',
    vitestArgs: ['watch']
  },
  'ci': {
    description: 'Run tests in CI mode with comprehensive reporting',
    vitestArgs: ['run', '--coverage', '--reporter=verbose', '--reporter=junit', '--outputFile.junit=./test-results/junit.xml']
  },
  'changed': {
    description: 'Run tests for changed files only',
    vitestArgs: ['run', '--changed']
  },
  'related': {
    description: 'Run tests related to changed files',
    vitestArgs: ['run', '--related']
  },
  'bail': {
    description: 'Stop on first test failure',
    vitestArgs: ['run', '--bail=1']
  }
};

// Help function
function showHelp() {
  console.log('Test Runner - Enhanced test execution for automated testing system\n');
  console.log('Usage: node scripts/test-runner.js <command> [options]\n');
  console.log('Available commands:');

  Object.entries(commands).forEach(([cmd, config]) => {
    console.log(`  ${cmd.padEnd(12)} - ${config.description}`);
  });

  console.log('\nAdditional options:');
  console.log('  --filter <pattern>  - Run tests matching pattern');
  console.log('  --timeout <ms>      - Set test timeout');
  console.log('  --threads <n>       - Set number of worker threads');
  console.log('  --silent            - Suppress output');
  console.log('  --verbose           - Verbose output');
  console.log('\nExamples:');
  console.log('  node scripts/test-runner.js unit');
  console.log('  node scripts/test-runner.js coverage --filter "storage"');
  console.log('  node scripts/test-runner.js ci --timeout 10000');
}

// Parse additional options
function parseOptions(args) {
  const options = {};
  const vitestArgs = [];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--filter':
        if (nextArg) {
          vitestArgs.push('-t', nextArg);
          i++; // Skip next argument
        }
        break;
      case '--timeout':
        if (nextArg) {
          vitestArgs.push('--testTimeout', nextArg);
          i++; // Skip next argument
        }
        break;
      case '--threads':
        if (nextArg) {
          vitestArgs.push('--poolOptions.threads.maxThreads', nextArg);
          i++; // Skip next argument
        }
        break;
      case '--silent':
        vitestArgs.push('--silent');
        break;
      case '--verbose':
        vitestArgs.push('--reporter=verbose');
        break;
      default:
        // Pass through unknown arguments
        vitestArgs.push(arg);
    }
  }

  return vitestArgs;
}

// Execute vitest with given arguments
function runVitest(vitestArgs) {
  const vitestPath = path.join(__dirname, '..', 'node_modules', '.bin', 'vitest');

  console.log(`Running: vitest ${vitestArgs.join(' ')}\n`);

  const child = spawn('npx', ['vitest', ...vitestArgs], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });

  child.on('close', (code) => {
    process.exit(code);
  });

  child.on('error', (error) => {
    console.error('Error running tests:', error);
    process.exit(1);
  });
}

// Main execution
if (!command || command === 'help' || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
}

const commandConfig = commands[command];
if (!commandConfig) {
  console.error(`Unknown command: ${command}`);
  console.error('Run "node scripts/test-runner.js help" for available commands');
  process.exit(1);
}

// Build final vitest arguments
const baseArgs = commandConfig.vitestArgs;
const additionalArgs = parseOptions(args);
const finalArgs = [...baseArgs, ...additionalArgs];

// Run the tests
runVitest(finalArgs);