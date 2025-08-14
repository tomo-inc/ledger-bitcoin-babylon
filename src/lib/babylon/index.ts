import { Script } from '@cmdcode/tapscript';
import { fromBech32 } from '@cosmjs/encoding';
import Transport from '@ledgerhq/hw-transport';
import { base64 } from '@scure/base';
import { Transaction } from '@scure/btc-signer';

import AppClient from '../appClient';
import { WalletPolicy } from '../policy';
import { encodeStakingTxPolicyToTLV, 
         encodeSlashingTxPolicyToTLV,
         encodeUnbondPolicyToTLV,
         encodeWithdrawPolicyToTLV } from './data';

import {
  createSegwitBip322Signature,
  createTaprootBip322Signature,
} from './bip322';
import { getLeafHash, getTaprootScript } from './psbt';
import {
  AddressType,
  MessageSigningProtocols,
  SignedMessage,
} from './types';

interface SignMessageOptions {
  transport: Transport;
  message: string;
  type: 'ecdsa' | 'bip322-simple';
  addressType?: AddressType;
  derivationPath?: string;
  isTestnet?: boolean;
}

export function validadteAddress(input: string): Uint8Array | void {
  try {
    const { prefix, data } = fromBech32(input);
    if (prefix == 'bbn' && data.length === 20) {
      return data;
    }
  } catch (e) {
    //
  }
}

export function computeLeafHash(psbt: Uint8Array | string): Buffer {
  const psbtBase64 = psbt instanceof Uint8Array ? base64.encode(psbt) : psbt;
  const script = getTaprootScript(psbtBase64);
  if (!script) {
    throw new Error('The psbt does not contain a taproot script.');
  }
  return getLeafHash(script);
}

async function _prepare(
  transport: Transport,
  derivationPath: string
): Promise<string[]> {
  const app = new AppClient(transport);
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(derivationPath);

  return [masterFingerPrint, extendedPublicKey];
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


export type SlashingPolicy =
  | undefined
  | 'Consent to slashing'
  | 'Consent to unbonding slashing';
export type SlashingParams = {
  leafHash: Buffer;
  timelockBlocks: number;
  finalityProviders: string[];
  covenantThreshold: number;
  covenantPks?: string[];
  slashingPkScriptHex: string;
  slashingFeeSat: number;
};

export async function slashingPathPolicy({
  policyName = 'Consent to slashing',
  transport,
  params,
  derivationPath,
  displayLeafHash = true,
  isTestnet = false,
}: {
  policyName?: SlashingPolicy;
  transport: Transport;
  params: SlashingParams;
  derivationPath?: string;
  displayLeafHash?: boolean;
  isTestnet?: boolean;
}): Promise<WalletPolicy> {
  console.log('displayLeafHash:', displayLeafHash);
  derivationPath = derivationPath
    ? derivationPath
    : `m/86'/${isTestnet ? 1 : 0}'/0'`;

  const {
    timelockBlocks,
    finalityProviders,
    covenantThreshold,
    covenantPks: _covenantPks, 
    slashingPkScriptHex,
    slashingFeeSat,
  } = params;
  const [masterFingerPrint, extendedPublicKey] = await _prepare(
    transport,
    derivationPath
  );
  const keys: string[] = [];
  const descriptorTemplate = "tr(@0/**)";
   keys.push(
    `[${derivationPath.replace(
      'm/',
      `${masterFingerPrint}/`
    )}]${extendedPublicKey}`
  );

   const tlvBuffer = encodeSlashingTxPolicyToTLV(
    timelockBlocks,
    finalityProviders,
    covenantThreshold,
    _covenantPks || [],
    slashingPkScriptHex,
    slashingFeeSat
  );
  console.log('slashingPathPolicy TLV buffer:', tlvBuffer.toString('hex'));
  const app = new AppClient(transport);
  try {
    await app.dataPrepare(tlvBuffer);
  } catch (error) {
    console.error('Error in dataPrepare:', error);
    throw error;
  }

  return new WalletPolicy(policyName, descriptorTemplate, keys);
}

export type UnbondingPolicy = undefined | 'Unbonding';
export type UnbondingParams = {
  leafHash: Buffer;
  timelockBlocks: number;
  finalityProviders: string[];
  covenantThreshold: number;
  covenantPks?: string[];
  unbondingFeeSat: number;
};


export type StakingTxPolicy = undefined | 'Staking transaction';
export type StakingTxParams = {
  timelockBlocks: number;
  finalityProviders: string[];
  covenantThreshold: number;
  covenantPks?: string[];
};

export async function stakingTxPolicy({
  policyName = 'Staking transaction',
  transport,
  params,
  derivationPath,
  isTestnet = false,
}: {
  policyName?: StakingTxPolicy;
  transport: Transport;
  params: StakingTxParams;
  derivationPath?: string;
  isTestnet?: boolean;
}): Promise<WalletPolicy> {
  derivationPath = derivationPath
    ? derivationPath
    : `m/86'/${isTestnet ? 1 : 0}'/0'`;
    const [masterFingerPrint, extendedPublicKey] = await _prepare(
    transport,
    derivationPath
  );
  const keys: string[] = [];
  const descriptorTemplate = "tr(@0/**)";
   keys.push(
    `[${derivationPath.replace(
      'm/',
      `${masterFingerPrint}/`
    )}]${extendedPublicKey}`
  );

  const {
    timelockBlocks,
    finalityProviders,
    covenantThreshold,
    covenantPks: _covenantPks,
  } = params;

  const tlvBuffer = encodeStakingTxPolicyToTLV(
    timelockBlocks,
    finalityProviders,
    covenantThreshold,
    _covenantPks || []
  );
  console.log('stakingTxPolicy TLV buffer:', tlvBuffer.toString('hex'));
  const app = new AppClient(transport);
  try {
    await app.dataPrepare(tlvBuffer);
  } catch (error) {
    console.error('Error in dataPrepare:', error);
    throw error;
  }

  return new WalletPolicy(policyName, descriptorTemplate, keys);
}

export async function unbondingPathPolicy({
  policyName = 'Unbonding',
  transport,
  params,
  derivationPath,
  displayLeafHash = true,
  isTestnet = false,
}: {
  policyName?: UnbondingPolicy;
  transport: Transport;
  params: UnbondingParams;
  derivationPath?: string;
  displayLeafHash?: boolean;
  isTestnet?: boolean;
}): Promise<WalletPolicy> {
  console.log('displayLeafHash:', displayLeafHash);
  derivationPath = derivationPath
    ? derivationPath
    : `m/86'/${isTestnet ? 1 : 0}'/0'`;

  const {
    timelockBlocks,
    finalityProviders,
    covenantThreshold,
    covenantPks: _covenantPks,
    unbondingFeeSat,
  } = params;
  const [masterFingerPrint, extendedPublicKey] = await _prepare(
    transport,
    derivationPath
  );
  const keys: string[] = [];
  const descriptorTemplate = "tr(@0/**)";
   keys.push(
    `[${derivationPath.replace(
      'm/',
      `${masterFingerPrint}/`
    )}]${extendedPublicKey}`
  );

   const tlvBuffer = encodeUnbondPolicyToTLV(
    timelockBlocks,
    finalityProviders,
    covenantThreshold,
    _covenantPks || [],
    unbondingFeeSat
  );
  console.log('slashingPathPolicy TLV buffer:', tlvBuffer.toString('hex'));
  const app = new AppClient(transport);
  try {
    await app.dataPrepare(tlvBuffer);
  } catch (error) {
    console.error('Error in dataPrepare:', error);
    throw error;
  }

  return new WalletPolicy(policyName, descriptorTemplate, keys);
}

export type TimelockPolicy = undefined | 'Withdraw';
export type TimelockParams = {
  leafHash: Buffer;
  timelockBlocks: number;
};

export async function timelockPathPolicy({
  policyName = 'Withdraw',
  transport,
  params,
  derivationPath,
  displayLeafHash = true,
  isTestnet = false,
}: {
  policyName?: TimelockPolicy;
  transport: Transport;
  params: TimelockParams;
  derivationPath?: string;
  displayLeafHash?: boolean;
  isTestnet?: boolean;
}): Promise<WalletPolicy> {
console.log('displayLeafHash:', displayLeafHash);
  derivationPath = derivationPath
    ? derivationPath
    : `m/86'/${isTestnet ? 1 : 0}'/0'`;

  const {
    timelockBlocks,
  } = params;
  const [masterFingerPrint, extendedPublicKey] = await _prepare(
    transport,
    derivationPath
  );
  const keys: string[] = [];
  const descriptorTemplate = "tr(@0/**)";
   keys.push(
    `[${derivationPath.replace(
      'm/',
      `${masterFingerPrint}/`
    )}]${extendedPublicKey}`
  );

   const tlvBuffer = encodeWithdrawPolicyToTLV(
    timelockBlocks
  );
  console.log('withdraw TLV buffer:', tlvBuffer.toString('hex'));
  const app = new AppClient(transport);
  try {
    await app.dataPrepare(tlvBuffer);
  } catch (error) {
    console.error('Error in dataPrepare:', error);
    throw error;
  }

  return new WalletPolicy(policyName, descriptorTemplate, keys);

}


// const SlashingPathRegexPrefix =
//   /^([a-f0-9]{64}) OP_CHECKSIGVERIFY ([a-f0-9]{64}) OP_CHECKSIGVERIFY ([a-f0-9]{64}) OP_CHECKSIG/;
// const UnbondingPathRegexPrefix =
//   /^([a-f0-9]{64}) OP_CHECKSIGVERIFY ([a-f0-9]{64}) OP_CHECKSIG/;
const TimelockPathRegex1 =
  /^([a-f0-9]{64}) OP_CHECKSIGVERIFY OP_(0|[1-9]|1[0-6]) OP_CHECKSEQUENCEVERIFY$/;
// const TimelockPathRegex2 =
//   /^([a-f0-9]{64}) OP_CHECKSIGVERIFY ([a-f0-9]{2,6}) OP_CHECKSEQUENCEVERIFY$/;

// function tryParseSlashingPath(decoded: string[]): string[] | void {
//   const script = decoded.join(' ');

//   if (!SlashingPathRegexPrefix.test(script)) return;

//   const result: string[] = [];
//   decoded.forEach((value) => {
//     if (/^([a-f0-9]{64})$/.test(value)) {
//       result.push(value);
//     } else if (/^OP_([0-9]{1,2})$/.test(value)) {
//       result.push(value);
//     }
//   });

//   return result;
// }

// function tryParseUnbondingPath(decoded: string[]): string[] | void {
//   const script = decoded.join(' ');

//   if (!UnbondingPathRegexPrefix.test(script)) {
//     return;
//   }

//   const result: string[] = [];
//   decoded.forEach((value) => {
//     if (/^([a-f0-9]{64})$/.test(value)) {
//       result.push(value);
//     } else if (/^OP_([0-9]{1,2})$/.test(value)) {
//       result.push(value);
//     }
//   });

//   return result;
// }

function _tryParseNumber(number: string): string {
  if (number.length % 2 !== 0) {
    throw new Error('Invalid timelock: odd-length hex string');
  }
  return number.match(/.{2}/g)?.reverse().join('') ?? '';
}

function tryParseTimelockPath(decoded: string[]): string[] | void {
  const script = decoded.join(' ');

  let match = script.match(TimelockPathRegex1);
  if (match) {
    const [stakerPK, timelockBlocks] = match;
    return [stakerPK, Number(timelockBlocks).toString(16)];
  }

//   match = script.match(TimelockPathRegex2);
//   if (!match) {
//     return;
//   }

  const [_, stakerPK, timelockBlocks] = match;

  return [stakerPK, _tryParseNumber(timelockBlocks)];
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
  // let parsed = tryParseSlashingPath(decodedScript);
  // if (parsed) {
  //   return slashingPathPolicy({
  //     transport,
  //     params: {
  //       leafHash,
  //       finalityProviders: [parsed[1]],
  //       covenantPks: parsed.slice(2, parsed.length - 1),
  //       covenantThreshold: parseInt(parsed[parsed.length - 1].slice(3), 10),
  //     },
  //     derivationPath,
  //     isTestnet,
  //   });
  // }

  // parsed = tryParseUnbondingPath(decodedScript);
  // if (parsed) {
  //   return unbondingPathPolicy({
  //     transport,
  //     params: {
  //       leafHash,
  //       covenantPks: parsed.slice(1, parsed.length - 1),
  //       covenantThreshold: parseInt(parsed[parsed.length - 1].slice(3), 10),
  //     },
  //     derivationPath,
  //     isTestnet,
  //   });
  // }

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
  const derivationPath = options.derivationPath ?? `m/86'/0'/0'`;

  const result = validadteAddress(options.message);
  if (!result) {
    throw new Error('The message should be a valid bbn address.');
  }

  if (options.type === 'bip322-simple') {
    const {
      transport,
      message,
      addressType = AddressType.p2tr,
      isTestnet = false,
    } = options;

    return signMessageBIP322({
      transport,
      message,
      addressType,
      derivationPath,
      isTestnet,
    });
  }

  const { transport, message } = options;
  return signMessageECDSA({
    transport,
    message,
    derivationPath,
  });
}

async function signMessageECDSA({
  transport,
  message,
  derivationPath = `m/86'/0'/0'`,
}: {
  transport: Transport;
  message: string;
  derivationPath: string;
}): Promise<SignedMessage> {
  const app = new AppClient(transport);
  const signature = await app.signMessage(
    Buffer.from(message),
    `${derivationPath}/0/0`
  );
  return {
    signature,
    protocol: MessageSigningProtocols.ECDSA,
  };
}

async function signMessageBIP322({
  transport,
  message,
  addressType = AddressType.p2tr,
  derivationPath = `m/86'/0'/0'`,
  isTestnet = false,
}: {
  transport: Transport;
  message: string;
  addressType: AddressType;
  derivationPath: string;
  isTestnet?: boolean;
}): Promise<SignedMessage> {
  const app = new AppClient(transport);
  if (addressType === AddressType.p2tr) {
    return createTaprootBip322Signature({
      message,
      app,
      derivationPath,
      isTestnet,
    });
  }

  return createSegwitBip322Signature({
    message,
    app,
    derivationPath,
    isTestnet,
  });
}