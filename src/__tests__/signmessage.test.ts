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
      const message = '392376b1ca863487087702a0f74e90d44cd1f339a5776687c591bf5402395511bbn1dppj9xellvzrh7x60vft4u8cpkyrvv3camt8ps';
      const result = await signMessage({
        transport,
        message,
        derivationPath: `m/86'/1'/0'/0/0`,
      });
      expect(result).toBeDefined();
    });
  });