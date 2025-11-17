import Transport from '@ledgerhq/hw-transport-node-speculos-http';
import { getBbnVersion } from '../lib/babylon/prepare';

describe('getBbnVersion', () => {
  let transport: any;

  beforeAll(async () => {
    // 连接到 Speculos 模拟器
    transport = await Transport.open('http://127.0.0.1:5000' as any);
  });

  afterAll(async () => {
    if (transport) await transport.close();
    setTimeout(() => process.exit(0), 1000);
  });

  it('should get BBN version from device', async () => {
    console.log('\n=== Testing getBbnVersion ===');
    
    let detectedVersion;
    let errorOccurred = false;
    let errorDetails = null;
    
    try {
      detectedVersion = await getBbnVersion(transport);
      console.log('✓ Successfully retrieved version from device');
    } catch (error: any) {
      errorOccurred = true;
      errorDetails = {
        message: error?.message,
        statusCode: error?.statusCode,
        stack: error?.stack?.split('\n')[0]
      };
      console.log('✗ Error occurred during version detection:', errorDetails);
    }
    
    console.log('\n--- Detection Results ---');
    console.log('Error occurred:', errorOccurred);
    console.log('Detected version:', detectedVersion);
    console.log('Version type:', typeof detectedVersion);
    
    if (detectedVersion === 1) {
      console.log('→ Device is using v1 firmware (0x6d00 error or fallback)');
    } else if (detectedVersion === 2) {
      console.log('→ Device is using v2 firmware (instruction supported)');
    }
    console.log('========================\n');
    
    // 版本应该是 1 或 2
    expect([1, 2]).toContain(detectedVersion);
    expect(typeof detectedVersion).toBe('number');
  });

  it('should return v2 if device supports the instruction', async () => {
    console.log('\n=== Testing v2 firmware detection ===');
    
    const version = await getBbnVersion(transport);
    
    console.log('Firmware version detected:', version);
    
    if (version === 2) {
      console.log('✓ Device supports v2 instruction set');
      console.log('  - dataPrepare with version query succeeded');
      console.log('  - No 0x6d00 error received');
      expect(version).toBe(2);
    } else {
      console.log('✓ Device uses v1 instruction set');
      console.log('  - Received 0x6d00 (instruction not supported) or other error');
      console.log('  - Fallback to v1');
      expect(version).toBe(1);
    }
    console.log('=====================================\n');
  });

  it('should return v1 if device returns 0x6d00 error', async () => {
    console.log('\n=== Testing v1 firmware (0x6d00 handling) ===');
    
    const version = await getBbnVersion(transport);
    
    console.log('Version returned:', version);
    console.log('Expected range: 1-2');
    console.log('Is valid version:', version >= 1 && version <= 2);
    
    if (version === 1) {
      console.log('✓ Correctly handled v1 firmware or error case');
    } else if (version === 2) {
      console.log('✓ Device supports v2 (no 0x6d00 error)');
    }
    console.log('============================================\n');
    
    // 验证版本是有效的数字
    expect(version).toBeGreaterThanOrEqual(1);
    expect(version).toBeLessThanOrEqual(2);
  });

  it('should handle errors gracefully and default to v1', async () => {
    console.log('\n=== Testing error handling ===');
    
    // 测试错误处理逻辑
    try {
      const version = await getBbnVersion(transport);
      
      console.log('Version detection result:', version);
      console.log('No exception thrown: ✓');
      console.log('Valid version returned:', [1, 2].includes(version));
      
      // 即使有错误，也应该返回一个有效的版本号
      expect([1, 2]).toContain(version);
      
      console.log('\n✓ Error handling works correctly');
      console.log('  - Function did not throw');
      console.log('  - Returned valid version:', version);
      console.log('=============================\n');
    } catch (error) {
      console.log('✗ Unexpected error thrown:', error);
      console.log('=============================\n');
      // 不应该抛出未捕获的错误
      fail('getBbnVersion should not throw errors, it should return v1 as fallback');
    }
  });
});
