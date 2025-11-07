import Transport from '@ledgerhq/hw-transport';
import { base64 } from '@scure/base';
import { Transaction } from '@scure/btc-signer';

import AppClient from '../appClient';
import { WalletPolicy } from '../policy';
import { getTaprootScript } from './psbt';
import {
  SignedMessage
} from './types';
import { signMessageBIP322 } from './bip322';
import { isTestnetPath, isFullFiveLevelPath } from './utils';
import { PsbtV2 } from '../psbtv2';

interface SignMessageOptions {
  transport: Transport;
  message: string;
  derivationPath: string;
}


function detectInputAddressType(psbtBase64: string, inputIndex: number): 'p2tr' | 'p2wpkh' | 'unknown' {
  try {
    const psbt = new PsbtV2();
    psbt.deserialize(Buffer.from(base64.decode(psbtBase64)));
    
    const witnessUtxo = psbt.getInputWitnessUtxo(inputIndex);
    if (witnessUtxo) {
      const scriptPubKey = witnessUtxo.scriptPubKey;
      
      if (scriptPubKey.length === 34 && scriptPubKey[0] === 0x51 && scriptPubKey[1] === 0x20) {
        return 'p2tr';
      }
      
      if (scriptPubKey.length === 22 && scriptPubKey[0] === 0x00 && scriptPubKey[1] === 0x14) {
        return 'p2wpkh';
      }
    }
  } catch (error) {
    console.warn('Failed to detect address type:', error);
  }
  
  return 'unknown';
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
    const addressType = detectInputAddressType(psbtBase64, idx);
    
    if (hasScript) {
      let processedSignature = signature[1].signature;
      
      if (addressType === 'p2tr' && processedSignature.length > 64) {
        if (processedSignature.length === 65) {
          processedSignature = processedSignature.slice(0, 64);
        } else {
          throw new Error(`Invalid Schnorr signature length: ${processedSignature.length} bytes. Expected 64 or 65 bytes.`);
        }
      }
      
      transaction.updateInput(
        idx,
        {
          tapScriptSig: [
            [
              {
                pubKey: new Uint8Array(signature[1].pubkey),
                leafHash: new Uint8Array(signature[1].tapleafHash || Buffer.alloc(32)),
              },
              new Uint8Array(processedSignature),
            ],
          ],
        },
        true
      );
    } else {
      let processedSignature = signature[1].signature;
      
      if (addressType === 'p2tr') {
        if (processedSignature.length > 64) {
          if (processedSignature.length === 65) {
            processedSignature = processedSignature.slice(0, 64);
          } else {
            throw new Error(`Invalid Schnorr signature length: ${processedSignature.length} bytes. Expected 64 or 65 bytes.`);
          }
        }
        
        transaction.updateInput(
          idx,
          {
            tapKeySig: new Uint8Array(processedSignature),
          },
          true
        );
      } else if (addressType === 'p2wpkh') {
        transaction.updateInput(
          idx,
          {
            partialSig: [
              [new Uint8Array(signature[1].pubkey), new Uint8Array(processedSignature)]
            ],
          },
          true
        );
      } else {
        console.warn(`Unknown address type for input ${idx}, defaulting to taproot key path`);
        if (processedSignature.length > 64) {
          if (processedSignature.length === 65) {
            processedSignature = processedSignature.slice(0, 64);
          }
        }
        
        transaction.updateInput(
          idx,
          {
            tapKeySig: new Uint8Array(processedSignature),
          },
          true
        );
      }
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
    derivationPath
  } = options;
  if (!transport) {
    throw new Error('signMessage: transport is required');
  }
  if (typeof message !== 'string' || message.length === 0) {
    throw new Error('signMessage: message must be a non-empty string');
  }
  console.log("Signing message:", message);

  if (!isFullFiveLevelPath(derivationPath)) {
      throw new Error('The derivation path should be a full five-level path.');
  }
  const isTestnet = isTestnetPath(derivationPath);  

  return signMessageBIP322({
      transport,
      message,
      derivationPath,
      isTestnet
    });
}
export { 
  withdrawPathPolicy,
  slashingPathPolicy,
  stakingTxPolicy,
  unbondingPathPolicy,
  expansionTxPolicy
} from './prepare';

export type {  
  SlashingParams, 
  StakingTxParams,  
  UnbondingParams 
} from './prepare';