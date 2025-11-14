import Transport from '@ledgerhq/hw-transport';
import { base64 } from '@scure/base';
import { Transaction } from '@scure/btc-signer';

import AppClient from '../appClient';
import { WalletPolicy } from '../policy';
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
      console.log(`[detectInputAddressType] Input ${inputIndex}: scriptPubKey length=${scriptPubKey.length}, hex=${scriptPubKey.toString('hex').substring(0, 20)}...`);
      
      if (scriptPubKey.length === 34 && scriptPubKey[0] === 0x51 && scriptPubKey[1] === 0x20) {
        console.log(`[detectInputAddressType] Input ${inputIndex}: detected as p2tr (Taproot)`);
        return 'p2tr';
      }
      
      if (scriptPubKey.length === 22 && scriptPubKey[0] === 0x00 && scriptPubKey[1] === 0x14) {
        console.log(`[detectInputAddressType] Input ${inputIndex}: detected as p2wpkh (Native SegWit)`);
        return 'p2wpkh';
      }
    }
    console.log(`[detectInputAddressType] Input ${inputIndex}: unknown address type`);
  } catch (error) {
    console.warn(`[detectInputAddressType] Input ${inputIndex}: Failed to detect address type:`, error);
  }
  
  return 'unknown';
}

function hasInputTaprootScript(psbtBase64: string, inputIndex: number): boolean {
  try {
    const psbtBuffer = Buffer.from(psbtBase64, 'base64');
    const Psbt = require('bitcoinjs-lib').Psbt;
    const psbt = Psbt.fromBuffer(psbtBuffer);
    
    const input = psbt.data.inputs[inputIndex];
    const hasScript = !!(input && input.tapLeafScript && input.tapLeafScript.length > 0);
    console.log(`[hasInputTaprootScript] Input ${inputIndex}: ${hasScript ? 'HAS' : 'NO'} taproot script`);
    return hasScript;
  } catch (error) {
    console.warn(`[hasInputTaprootScript] Input ${inputIndex}: Failed to check taproot script:`, error);
    return false;
  }
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
  console.log('[signPsbt] Starting PSBT signing process...');
  const signatures = await app.signPsbt(psbtBase64, policy, null);
  console.log(`[signPsbt] Received ${signatures.length} signature(s) from Ledger`);

  const transaction = Transaction.fromPSBT(base64.decode(psbtBase64));
  for (const signature of signatures) {
    const idx = signature[0];
    console.log(`\n[signPsbt] === Processing signature for input ${idx} ===`);
    
    const addressType = detectInputAddressType(psbtBase64, idx);
    const hasScript = hasInputTaprootScript(psbtBase64, idx);
    
    console.log(`[signPsbt] Input ${idx}: addressType=${addressType}, hasScript=${hasScript}`);
    console.log(`[signPsbt] Input ${idx}: signature length=${signature[1].signature.length} bytes`);
    console.log(`[signPsbt] Input ${idx}: pubkey length=${signature[1].pubkey.length} bytes`);
    if (signature[1].tapleafHash) {
      console.log(`[signPsbt] Input ${idx}: tapleafHash present (${signature[1].tapleafHash.length} bytes)`);
    }
    
    if (hasScript) {
      console.log(`[signPsbt] Input ${idx}: Using tapScriptSig (script path)`);
      let processedSignature = signature[1].signature;
      
      if (addressType === 'p2tr' && processedSignature.length > 64) {
        if (processedSignature.length === 65) {
          console.log(`[signPsbt] Input ${idx}: Trimming Schnorr signature from 65 to 64 bytes`);
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
      console.log(`[signPsbt] Input ${idx}: tapScriptSig added successfully`);
    } else {
      let processedSignature = signature[1].signature;
      
      if (addressType === 'p2tr') {
        console.log(`[signPsbt] Input ${idx}: Using tapKeySig (Taproot key path)`);
        if (processedSignature.length > 64) {
          if (processedSignature.length === 65) {
            console.log(`[signPsbt] Input ${idx}: Trimming Schnorr signature from 65 to 64 bytes`);
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
        console.log(`[signPsbt] Input ${idx}: tapKeySig added successfully (${processedSignature.length} bytes)`);
      } else if (addressType === 'p2wpkh') {
        console.log(`[signPsbt] Input ${idx}: Using partialSig (Native SegWit ECDSA)`);
        transaction.updateInput(
          idx,
          {
            partialSig: [
              [new Uint8Array(signature[1].pubkey), new Uint8Array(processedSignature)]
            ],
          },
          true
        );
        console.log(`[signPsbt] Input ${idx}: partialSig added successfully (${processedSignature.length} bytes ECDSA/DER)`);
      } else {
        console.warn(`[signPsbt] Input ${idx}: Unknown address type, defaulting to taproot key path`);
        if (processedSignature.length > 64) {
          if (processedSignature.length === 65) {
            console.log(`[signPsbt] Input ${idx}: Trimming signature from 65 to 64 bytes`);
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
        console.log(`[signPsbt] Input ${idx}: tapKeySig added (fallback)`);
      }
    }
  }

  console.log('[signPsbt] All signatures processed successfully\n');
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