/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testRegex: '\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/src/app/$1',
    '^@platform/(.*)$': '<rootDir>/src/platform/$1',
    '^@domain/(.*)$': '<rootDir>/src/domain/$1',
    '^@contracts/(.*)$': '<rootDir>/../../shared/contracts/$1',
    '^@$': '<rootDir>/src/events',
  },
};
