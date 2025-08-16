import Transport from '@ledgerhq/hw-transport-node-speculos-http';
import { signMessage } from '..';

describe('signmessage policy', () => {
  let transport: any;

  beforeAll(async () => {
    transport = await Transport.open('http://127.0.0.1:5000' as any);
  });

  afterAll(async () => {
    if (transport) await transport.close();
    setTimeout(() => process.exit(0), 1000);
  });


    it("can sign message", async () => {
      jest.setTimeout(30000);
      const message = '6843229b3ffb043bf8da7b12baf0f80d88363238';
      const result = await signMessage({
        transport,
        message,
        type: 'bip322-simple',
        derivationPath: `m/86'/0'/0'`,
        isTestnet: false,
      });
      expect(result).toBeDefined();
    });
  });