// Jest 设置文件
// 为测试环境提供 crypto 对象

if (typeof globalThis.crypto === 'undefined') {
  const { webcrypto } = require('crypto');
  globalThis.crypto = webcrypto;
}

// 如果上面不行，使用这个备用方案
if (typeof global.crypto === 'undefined') {
  global.crypto = require('crypto');
}

jest.setTimeout(30000);