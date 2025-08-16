import Transport from '@ledgerhq/hw-transport';
import { base64 } from '@scure/base';
import { Transaction } from '@scure/btc-signer';

import AppClient from '../appClient';
import { WalletPolicy } from '../policy';
import { getTaprootScript } from './psbt';
import {
  AddressType,
  SignedMessage,
} from './types';
import { signMessageBIP322 } from './bip322';

interface SignMessageOptions {
  transport: Transport;
  message: string;
  type: 'bip322-simple'; 
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


export async function signMessage(
  options: SignMessageOptions
): Promise<SignedMessage> {

  const {
    transport,
    message,
    type,
    addressType,
    derivationPath,
    isTestnet,
  } = options;

  if (!transport) {
    throw new Error('signMessage: transport is required');
  }
  if (typeof message !== 'string' || message.length === 0) {
    throw new Error('signMessage: message must be a non-empty string');
  }
  if (type !== 'bip322-simple') {
    throw new Error('signMessage: type must be "bip322-simple"');
  }

  return signMessageBIP322({
      transport,
      message,
      addressType,
      derivationPath,
      isTestnet,
    });
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