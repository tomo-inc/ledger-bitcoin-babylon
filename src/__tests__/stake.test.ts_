import Transport from '@ledgerhq/hw-transport-node-speculos-http';
import { AppClient,DefaultWalletPolicy,PsbtV2 } from '..';
import { stakingTxPolicy } from '../lib/babylon/index';
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


  it('should send tlv data for stake', async () => {
    const params = {
      timelockBlocks: 64000,
      finalityProviders: ['d66124f8f42fd83e4c901a100ae3b5d706ef6cfd217b04bc64152e739a30c41e'],
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
      ]
    };

    const policy = await stakingTxPolicy({
      policyName: 'Staking transaction',
      transport,
      params,
      derivationPath: `m/86'/1'/0'`,
      isTestnet: true,
    });

    expect(policy).toBeDefined();
    expect(policy.descriptorTemplate).toBe('tr(@0/**)');
  });


  it("can sign stake", async () => {
    jest.setTimeout(30000);
    // psbt from test_sign_psbt_singlesig_wpkh_2to2 in the main test suite, converted to PSBTv2
    const psbtBuf = Buffer.from(
       "cHNidP8BAIkCAAAAAQoDdUgOA5oDhvrH0NWZTa/GJzvd4UhFIbmbOiWufc84AAAAAAD/////AlDDAAAAAAAAIlEg12Pea0ceMFZBukHWXGeC6MvP9uCOg9qrDaEnW7yfqtAcAi0AAAAAACJRIHQO5k5FLjuu4SewPBlbzCGtPt3tLvJsWvSD2cVjBNHlAAAAAAABASvAxi0AAAAAACJRIHQO5k5FLjuu4SewPBlbzCGtPt3tLvJsWvSD2cVjBNHlARcg3I0vnv8MT0294HCkjjMO/JCLYqdmVo2R5ljyhLMkuHgAAAA=",
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
    const expectedSighash = Buffer.from("672C460A4AB491DD3B70BC5E35D4796683AF95B11F68D4667A8963CBC52A3CDF", "hex");
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
    console.log("Pubkey:", Buffer.from(partialSig0.pubkey).toString('hex'));
    console.log("Expected pubkey:", expectedPubkey.toString('hex'));
    console.log("Signature length:", partialSig0.signature.length);
    console.log("Signature (first 64 bytes):", Buffer.from(partialSig0.signature.slice(0, 64)).toString('hex'));
    
    // 注意：实际的 Schnorr 签名验证需要实现 BIP-340 算法
    // 这里我们只验证了数据格式和关键字段
    console.log("✅ All validations passed!");
    });
});