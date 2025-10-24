import Transport from '@ledgerhq/hw-transport-node-speculos-http';
import { AppClient, PsbtV2 } from '..';
import { stakingTxPolicy } from '../lib/babylon/index';
import { ec as EC } from 'elliptic';

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


  it('should sign native segwit for stake', async () => {
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
      transport,
      params,
      derivationPath: `m/84'/1'/0'/0/0`,
    });
    const psbtBuf = Buffer.from(
       "cHNidP8BAH0CAAAAAaEtHx7dpPIS1RLs5LOtnYXmhBKx5eRgnL1yeeWlS6iVAAAAAAD/////AkBCDwAAAAAAIlEgO0v4HIc+jMw1cCYcWnQXJOyy2tGq1peFMCdNKD6bmFEYBT0AAAAAABYAFDXG4N1tPISxa6iF3Kc6yGPQtZPsAAAAAAABAR9AS0wAAAAAABYAFBNH6CoDe127OM+MR1nyQrH1x+CaIgYCfLddNLAFxOufYrvyxFfXY46BPnV+/OyPpoZ32VC2NmIY9azC/VQAAIABAACAAAAAgAAAAAAAAAAAAAAA",
       "base64"
    );
    const psbt = new PsbtV2();
    psbt.deserialize(psbtBuf);
    const result = await app.signPsbt(psbt, policy, null, () => {});
    console.log("Result:", JSON.stringify(result, (_, value) => {
      if (Buffer.isBuffer(value)) {
      return value.toString('hex');
      }
      return value;
    }, 2));
    // 验证结果长度
    //expect(result.length).toEqual(1);
    
    // Python 验证数据
    const expectedSighash = Buffer.from("172C927D125C64A7241660276BE2E6C2782E0373EF99A4ACA122F8E2628D18E9", "hex");
    const expectedPubkey = Buffer.from("027CB75D34B005C4EB9F62BBF2C457D7638E813E757EFCEC8FA68677D950B63662", "hex");
    
    // 验证第一个签名结果
    const [idx0, partialSig0] = result[0];
    expect(idx0).toBe(0);
    let signature = partialSig0.signature;  // ECDSA签名通常是DER格式
    // const derLen = signature[1] + 1; // DER格式的长度
    // signature = signature.slice(0, derLen);
    // console.log("derlen:", derLen);
    console.log("Signature (hex):", signature.toString('hex'));
    console.log("Pubkey (hex):", Buffer.from(partialSig0.pubkey).toString('hex'));
    console.log("Expected pubkey (hex):", expectedPubkey.toString('hex'));
    console.log("Sighash (hex):", expectedSighash.toString('hex'));

    // try {
    //   const decoded = script.signature.decode(signature);
    //   console.log("Decoded signature (hex):", decoded.signature.toString('hex'));
    //   console.log("Decoded hashType:", decoded.hashType);
    // } catch (e) {
    //   console.error("DER decode error:", e);
    // }
    const ec = new EC('secp256k1');
    const key = ec.keyFromPublic(expectedPubkey.toString('hex'), 'hex');
    const derSignature = signature; // 你的 DER 格式
    const isValid = key.verify(expectedSighash, derSignature);
    // const ec = new EC('secp256k1');
    // const key = ec.keyFromPublic(expectedPubkey.toString('hex'), 'hex');

    // // 解析 DER 签名为 elliptic 的 Signature 对象
    // const sigObj = Signature.fromDER(signature);

    // // 用 r/s 对象验证
    // const isValid = key.verify(expectedSighash, sigObj);

    // const isValidSignature = ecc.verify(expectedSighash, expectedPubkey, signature);
    // expect(isValidSignature).toBe(true);
    // const keyPair = ECPair.fromPublicKey(expectedPubkey);
    // const isValid = keyPair.verify(expectedSighash, signature);
    // console.log("bitcoinjs-lib verify:", isValid);
    console.log("elliptic verify:", isValid);
    console.log("Result length:", result.length);
    console.log("Index:", idx0);
    console.log("Pubkey:", Buffer.from(partialSig0.pubkey).toString('hex'));
    console.log("Expected pubkey:", expectedPubkey.toString('hex'));
    console.log("Signature length:", partialSig0.signature.length);
    console.log("Signature (first 64 bytes):", Buffer.from(partialSig0.signature.slice(0, 64)).toString('hex'));
    console.log("✅ All validations passed!");

  });
});