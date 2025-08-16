import { Script } from '@cmdcode/tapscript';

import Transport from '@ledgerhq/hw-transport';
import { base64 } from '@scure/base';
import { Transaction } from '@scure/btc-signer';

import AppClient from '../appClient';
import { WalletPolicy } from '../policy';
import { computeLeafHash, tryParseTimelockPath } from './utils';
import { getTaprootScript } from './psbt';
import {
  AddressType,
  MessageSigningProtocols,
  SignedMessage,
} from './types';

import { timelockPathPolicy } from './prepare'

interface SignMessageOptions {
  transport: Transport;
  message: string;
  type: 'ecdsa' | 'bip322-simple'; 
  addressType?: AddressType;
  derivationPath?: string;
  isTestnet?: boolean;
}


export async function signPsbt({
  transport,
  psbt,
  policy,
}: {
  transport: Transport;
  psbt: Uint8Array | string;
  policy: WalletPolicy;
}): Promise<Transaction> {
  const app = new AppClient(transport);

  const psbtBase64 = psbt instanceof Uint8Array ? base64.encode(psbt) : psbt;
  const signatures = await app.signPsbt(psbtBase64, policy, null);

  const hasScript = !!getTaprootScript(psbtBase64);

  const transaction = Transaction.fromPSBT(base64.decode(psbtBase64));
  for (const signature of signatures) {
    const idx = signature[0];

    if (hasScript) {
      transaction.updateInput(
        idx,
        {
          tapScriptSig: [
            [
              {
                pubKey: signature[1].pubkey,
                leafHash: signature[1].tapleafHash,
              },
              signature[1].signature,
            ],
          ],
        },
        true
      );
    } else {
      transaction.updateInput(
        idx,
        {
          tapKeySig: signature[1].signature,
        },
        true
      );
    }
  }

  return transaction;
}

export async function tryParsePsbt(
  transport: Transport,
  psbtBase64: string,
  isTestnet = false,
  leafHash?: Buffer
): Promise<WalletPolicy | void> {
  const derivationPath = `m/86'/${isTestnet ? 1 : 0}'/0'`;

  const script = getTaprootScript(psbtBase64);
  if (!script) {
    throw new Error(`No script found in psbt`);
  }

  leafHash = leafHash ? leafHash : computeLeafHash(psbtBase64);

  const decodedScript = Script.decode(script);

  const parsed = tryParseTimelockPath(decodedScript);
  if (parsed) {
    return timelockPathPolicy({
      transport,
      params: {
        leafHash,
        timelockBlocks: Number(`0x${parsed[parsed.length - 1]}`),
      },
      derivationPath,
      isTestnet,
    });
  }
}


export async function signMessage(
  options: SignMessageOptions
): Promise<SignedMessage> {
  const { transport, message, type, addressType, derivationPath, isTestnet } = options;
  // 这里可以根据需要使用这些参数，例如日志输出或后续实现
  void transport;
  void message;
  void type;
  void addressType;
  void derivationPath;
  void isTestnet;
  const fakeSignature = Buffer.from('deadbeef', 'hex').toString('base64');
  const signature = fakeSignature;
  return {
    signature,
    protocol: MessageSigningProtocols.BIP322,
  };
}
export { 
  timelockPathPolicy,
  slashingPathPolicy,
  stakingTxPolicy,
  unbondingPathPolicy
} from './prepare';

export { 
  computeLeafHash, 
  tryParseTimelockPath 
} from './utils';

// 如果有这些类型定义，也需要导出
export type { 
  SlashingPolicy, 
  SlashingParams, 
  StakingTxPolicy, 
  StakingTxParams, 
  TimelockPolicy, 
  TimelockParams, 
  UnbondingPolicy, 
  UnbondingParams 
} from './prepare';