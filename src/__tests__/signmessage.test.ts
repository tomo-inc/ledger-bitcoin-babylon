import Transport from '@ledgerhq/hw-transport-node-speculos-http';
import { AppClient,DefaultWalletPolicy,PsbtV2 } from '..';
import { encodeSignMessagePolicyToTLV } from '../lib/babylon/data';
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


  it('should sending tlv for sign message', async () => {
    const params = {
      message:'6843229b3ffb043bf8da7b12baf0f80d88363238',
      pubkey:'740ee64e452e3baee127b03c195bcc21ad3edded2ef26c5af483d9c56304d1e5'
    };

  const policy = await encodeSignMessagePolicyToTLV({
          message,
          pubkey
        });

    const policy = await signMessage({
      policyName: 'Sign message',
      transport,
      params,
      derivationPath: `m/86'/1'/0'`,
      displayLeafHash: false,
      isTestnet: true,
    });

    expect(policy).toBeDefined();
    expect(policy.descriptorTemplate).toBe('tr(@0/**)');
  });


  it("can sign message", async () => {
    jest.setTimeout(30000);
    // psbt from test_sign_psbt_singlesig_wpkh_2to2 in the main test suite, converted to PSBTv2
    const psbtBuf = Buffer.from(
       "cHNidP8BAH0CAAAAAU5oPucfQQOAdrEZwJODBvpzHfaA/orEXxwbxelbMexgAAAAAAD/////AsQJAAAAAAAAFgAUW+EmJNCKK0JAldfAciHDNFDRS/EEpgAAAAAAACJRICyVutUKY9E6qBjfjktoZBga2/RyCoiq+OPBI1ugik2fAAAAAAABAStQwwAAAAAAACJRINdj3mtHHjBWQbpB1lxngujLz/bgjoPaqw2hJ1u8n6rQQhXBUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsCJtgX5iDHD5SbZ6yF5ZRRSk4qMD/f16u7MthJR1dRt6/15ASDcjS+e/wxPTb3gcKSOMw78kItip2ZWjZHmWPKEsyS4eK0g1mEk+PQv2D5MkBoQCuO11wbvbP0hewS8ZBUuc5owxB6tIAruBQmxbbccmZI4pIJ9uUVSaFmxPJVIerRnJTV8mp8lrCARPDoyqdMgtyGQoEoCCg2zl27zaXJnMljpo4o2Tz3DsLogF5Ic8VbMtOc9Qo+ZbtEbJFMT434nyXisTSzCHspGcuS6IDu5PfyLYYh9dx82MOmmPpfLr8/MeFVqR034OjGg74mcuiBAr69HxP+lbehkENjke6ortvBLYE9OokMjc33cP+CS37ogeacf/XHFA+8uL5G8z8j82nlG9GU87w2fPd4geV7zufC6INIfr3jGdRoNOOa9gCi5B/8H6ahppD/IN9az+N/2EZo2uiD1GZ764/KLuCR2Fjp+RYx61EXZv/sGgtENO9sstB+Ojrog+p2ILUX0BgvbgEIYOCjNh1RPHqmXOA5YbKt31f1phze6VpzAARcgUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsAAAAA=",
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
    const expectedSighash = Buffer.from("BA111E858EED59BA9527273BC8DFB047AE96BE59B6B4EC3769F6C35E5135134C", "hex");
    const expectedLeafHash = Buffer.from("ed429f93af8bb724a9f5066248b32d945fdd1c12f7f59a33f4f83b6565716750", "hex");
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