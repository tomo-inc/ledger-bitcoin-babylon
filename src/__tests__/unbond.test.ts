import Transport from '@ledgerhq/hw-transport-node-speculos-http';
import { AppClient,DefaultWalletPolicy,PsbtV2 } from '..';
import { unbondingPathPolicy } from '../lib/babylon/index';
import * as ecc from 'tiny-secp256k1';

describe('stakingTxPolicy', () => {
  let transport: any;
  let app: AppClient;

  beforeAll(async () => {
    transport = await Transport.open('http://127.0.0.1:5000' as any);
    app = new AppClient(transport);
  });

  afterAll(async () => {
    if (transport) await transport.close();
    setTimeout(() => process.exit(0), 1000);
  });


  it('should send tlv data to unbond', async () => {
    const params = {
      timelockBlocks: 1008,
      finalityProviders: ['d23c2c25e1fcf8fd1c21b9a402c19e2e309e531e45e92fb1e9805b6056b0cc76'],
      covenantThreshold: 6,
      covenantPks: [
        '0aee0509b16db71c999238a4827db945526859b13c95487ab46725357c9a9f25',
        '113c3a32a9d320b72190a04a020a0db3976ef36972673258e9a38a364f3dc3b0',
        '17921cf156ccb4e73d428f996ed11b245313e37e27c978ac4d2cc21eca4672e4',
        '3bb93dfc8b61887d771f3630e9a63e97cbafcfcc78556a474df83a31a0ef899c',
        '40afaf47c4ffa56de86410d8e47baa2bb6f04b604f4ea24323737ddc3fe092df',
        '79a71ffd71c503ef2e2f91bccfc8fcda7946f4653cef0d9f3dde20795ef3b9f0',
        'd21faf78c6751a0d38e6bd8028b907ff07e9a869a43fc837d6b3f8dff6119a36',
        'f5199efae3f28bb82476163a7e458c7ad445d9bffb0682d10d3bdb2cb41f8e8e',
        'fa9d882d45f4060bdb8042183828cd87544f1ea997380e586cab77d5fd698737',
      ],
      unbondingFeeSat: 2000,
      leafHash: Buffer.from('b537e46643bb97918f166ca08893e75a4e5044e92abc0d48259b348b04f4ad5f', 'hex')
    };

    const policy = await unbondingPathPolicy({
      policyName: 'Unbonding',
      transport,
      params,
      derivationPath: `m/86'/1'/0'`,
      displayLeafHash: false,
      isTestnet: true,
    });

    expect(policy).toBeDefined();
    expect(policy.descriptorTemplate).toBe('tr(@0/**)');
  });


  it("can sign unbond", async () => {
    jest.setTimeout(30000);
    // psbt from test_sign_psbt_singlesig_wpkh_2to2 in the main test suite, converted to PSBTv2
    const psbtBuf = Buffer.from(
       "cHNidP8BAF4CAAAAARSsiq2TFq5P/835EAvNgCZXDC6CS1+xtit+DY7G1dygAAAAAAD/////AZDiAAAAAAAAIlEg/pvwU6TWJxOSa6vlGbQnPyEX/XzVCkXJjxRCchhfo2EAAAAAAAEBK2DqAAAAAAAAIlEgvuEgqB2XZe+afeBe8ZLwNCRA7hqxujxpU15NDJOT+tFiFcFQkpt0waBJVLeLS2A16XpeB4paDyjsltVHv+6azoA6wGiUOxKox1UcaYkUfLw1P/gRozOyIAYscJZUYYhS14qO7WLOBOR2DLfcS2FXnhYLyDSDei74a1DrKfwNlVI2ikX9VwEg3I0vnv8MT0294HCkjjMO/JCLYqdmVo2R5ljyhLMkuHitIAruBQmxbbccmZI4pIJ9uUVSaFmxPJVIerRnJTV8mp8lrCARPDoyqdMgtyGQoEoCCg2zl27zaXJnMljpo4o2Tz3DsLogF5Ic8VbMtOc9Qo+ZbtEbJFMT434nyXisTSzCHspGcuS6IDu5PfyLYYh9dx82MOmmPpfLr8/MeFVqR034OjGg74mcuiBAr69HxP+lbehkENjke6ortvBLYE9OokMjc33cP+CS37ogeacf/XHFA+8uL5G8z8j82nlG9GU87w2fPd4geV7zufC6INIfr3jGdRoNOOa9gCi5B/8H6ahppD/IN9az+N/2EZo2uiD1GZ764/KLuCR2Fjp+RYx61EXZv/sGgtENO9sstB+Ojrog+p2ILUX0BgvbgEIYOCjNh1RPHqmXOA5YbKt31f1phze6VpzAARcgUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsAAAA==",
       "base64"
    );

    const walletPolicy = new DefaultWalletPolicy(
      "tr(@0/**)",
      "[f5acc2fd/86'/1'/0']tpubDDKYE6BREvDsSWMazgHoyQWiJwYaDDYPbCFjYxN3HFXJP5fokeiK4hwK5tTLBNEDBwrDXn8cQ4v9b2xdW62Xr5yxoQdMu1v6c7UDXYVH27U"
    );

    const psbt = new PsbtV2();
    psbt.deserialize(psbtBuf);
    const result = await app.signPsbt(psbt, walletPolicy, null, () => {});

    // 验证结果长度
    expect(result.length).toEqual(1);
    
    // Python 验证数据
    const expectedSighash = Buffer.from("78FB17A1258D8088DF74C8512F1845EDF8B026EFB814B971C7BC2971CCD9C2A8", "hex");
    const expectedLeafHash = Buffer.from("b537e46643bb97918f166ca08893e75a4e5044e92abc0d48259b348b04f4ad5f", "hex");
    const expectedPubkey = Buffer.from("dc8d2f9eff0c4f4dbde070a48e330efc908b62a766568d91e658f284b324b878", "hex");
    
    // 验证第一个签名结果
    const [idx0, partialSig0] = result[0];
    expect(idx0).toBe(0);


     // BIP-340 Schnorr 签名验证
   const signature = partialSig0.signature.slice(0, 64); // 取前 64 字节作为签名
  console.log("Signature (hex):", signature.toString('hex'));
   const isValidSignature = ecc.verifySchnorr(expectedSighash, expectedPubkey, signature);
   expect(isValidSignature).toBe(true);
    

    console.log("Result length:", result.length);
    console.log("Index:", idx0);
    console.log("Tapleaf hash:", Buffer.from(partialSig0.tapleafHash!).toString('hex'));
    console.log("Expected leaf hash:", expectedLeafHash.toString('hex'));
    console.log("Pubkey:", Buffer.from(partialSig0.pubkey).toString('hex'));
    console.log("Expected pubkey:", expectedPubkey.toString('hex'));
    console.log("Signature length:", partialSig0.signature.length);
    console.log("Signature (first 64 bytes):", Buffer.from(partialSig0.signature.slice(0, 64)).toString('hex'));
    
    // 注意：实际的 Schnorr 签名验证需要实现 BIP-340 算法
    // 这里我们只验证了数据格式和关键字段
    console.log("✅ All validations passed!");
    });
});