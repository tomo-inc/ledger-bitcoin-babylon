import Transport from '@ledgerhq/hw-transport-node-speculos-http';
import { AppClient, PsbtV2 } from '..';
import { stakingTxPolicy } from '../lib/babylon/index';
import * as bitcoin from 'bitcoinjs-lib';
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
  });


  it('should sign native segwit for stake', async () => {
    const params = {
      timelockBlocks: 64000,
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
      ]
    };

    const policy = await stakingTxPolicy({
      transport,
      params,
      derivationPath: `m/84'/1'/0'/0/0`,
    });
    const psbtBuf = Buffer.from(
       "cHNidP8BAH0CAAAAAftH5TYiqKRA11SH2AYDNhLau1BnpuD4Ix1v7KOBnqJEAQAAAAD/////AnARAQAAAAAAIlEgOmYCuc8dH9hbNqg0qhqmboANe37xYmQ+jPc10iilT8kVrxoAAAAAABYAFBNH6CoDe127OM+MR1nyQrH1x+CaAAAAAAABAR9IwRsAAAAAABYAFBNH6CoDe127OM+MR1nyQrH1x+CaAAAA",
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
    const expectedSighash = Buffer.from(
      'DCFFD40872E37A7692EE914F6E1C477329AF3ACD6C72419386565A3FBA650C4A',
      'hex',
    );
    const expectedPubkey = Buffer.from(
      '027CB75D34B005C4EB9F62BBF2C457D7638E813E757EFCEC8FA68677D950B63662',
      'hex',
    );
    
    // 验证第一个签名结果
    const [idx0, partialSig0] = result[0];
    expect(idx0).toBe(0);
    const signature: Buffer = partialSig0.signature as Buffer;
    console.log('Signature (hex):', signature.toString('hex'));
    console.log('Pubkey (hex):', Buffer.from(partialSig0.pubkey).toString('hex'));
    console.log('Expected pubkey (hex):', expectedPubkey.toString('hex'));
    console.log('Sighash (hex):', expectedSighash.toString('hex'));

    // 用 bitcoinjs-lib 解码 DER 签名（输入需包含末尾的 sighashType）
    const decoded = bitcoin.script.signature.decode(signature);
    console.log('Decoded signature (hex):', decoded.signature.toString('hex'));
    console.log('Decoded hashType:', decoded.hashType);

    // 基于 PSBT 计算实际的 BIP-143 sighash（P2WPKH）
    const tx = new bitcoin.Transaction();
    tx.version = psbt.getGlobalTxVersion();
    const locktime = psbt.getGlobalFallbackLocktime();
    if (locktime !== undefined) tx.locktime = locktime;

    const inputCount = psbt.getGlobalInputCount();
    for (let i = 0; i < inputCount; i++) {
      const prevHash = psbt.getInputPreviousTxid(i);
      const index = psbt.getInputOutputIndex(i);
      const seq = psbt.getInputSequence(i);
      tx.addInput(prevHash, index, seq);
    }
    const outputCount = psbt.getGlobalOutputCount();
    for (let i = 0; i < outputCount; i++) {
      const value = psbt.getOutputAmount(i);
      const script = psbt.getOutputScript(i);
      tx.addOutput(script, value);
    }

    const utxo0 = psbt.getInputWitnessUtxo(0);
    if (!utxo0) throw new Error('Missing witnessUtxo for input 0');
    const spk = utxo0.scriptPubKey;
    if (!(spk.length === 22 && spk[0] === 0x00 && spk[1] === 0x14)) {
      throw new Error('Input 0 is not P2WPKH');
    }
    const h160 = spk.slice(2);
    const scriptCode = bitcoin.payments.p2pkh({ hash: h160 }).output!;
    const computedSighash = tx.hashForWitnessV0(0, scriptCode, utxo0.amount, decoded.hashType);
    console.log('Computed sighash (hex):', computedSighash.toString('hex'));

    // 使用 tiny-secp256k1 直接验证 (decoded.signature 是 64 字节 r||s)
    const isValid = ecc.verify(computedSighash, expectedPubkey, decoded.signature);
    console.log('tiny-secp256k1 verify:', isValid);
    expect(isValid).toBe(true);

  });
});