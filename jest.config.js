module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.js$': 'babel-jest',
  },
  transformIgnorePatterns: [
    "node_modules/(?!(axios)/)"
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  globals: {
    crypto: require('crypto')
  },
  testTimeout: 30000
};
