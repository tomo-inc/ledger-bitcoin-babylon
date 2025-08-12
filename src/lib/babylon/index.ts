import { createHash } from 'crypto';

import { Script } from '@cmdcode/tapscript';
import { fromBech32 } from '@cosmjs/encoding';
import Transport from '@ledgerhq/hw-transport';
import { base64 } from '@scure/base';
import { Transaction } from '@scure/btc-signer';

import AppClient from '../appClient';
import { numberToLE } from '../buffertools';
import { WalletPolicy } from '../policy';
import { encodeStakingTxPolicyToTLV, encodeSlashingTxPolicyToTLV } from './data';

import {
  createSegwitBip322Signature,
  createTaprootBip322Signature,
} from './bip322';
import { getLeafHash, getTaprootScript } from './psbt';
import {
  AddressType,
  MagicCode,
  MessageSigningProtocols,
  SignedMessage,
} from './types';
import { createExtendedPubkey } from './xpub';

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

export function computeLeafHash(psbt: Uint8Array | string): Buffer {
  const psbtBase64 = psbt instanceof Uint8Array ? base64.encode(psbt) : psbt;
  const script = getTaprootScript(psbtBase64);
  if (!script) {
    throw new Error('The psbt does not contain a taproot script.');
  }
  return getLeafHash(script);
}

export function formatKey(key: string | Buffer, isTestnet: boolean): string {
  const pubkey =
    key instanceof Buffer ? key : Buffer.from(key as string, 'hex');
  return createExtendedPubkey(
    !isTestnet ? 'Mainnet' : 'Testnet',
    0,
    Buffer.from('00000000', 'hex'),
    0,
    createHash('sha256').update(pubkey).digest().subarray(0, 32),
    Buffer.concat([Buffer.from('02', 'hex'), pubkey])
  );
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

// Only a single finality provider is supported for now.
function _filterFinalityProviders(finalityProviders?: string[]): string {
  if (!finalityProviders || finalityProviders.length === 0) {
    throw new Error('Must provide at least one finality provider.');
  }

  if (finalityProviders.length > 1) {
    throw new Error(`Currently only a single finality provider is supported.`);
  }

  return finalityProviders[0];
}

function _checkCovenantInfo(
  covenantThreshold: number,
  covenantPks?: string[]
): string[] {
  if (covenantThreshold < 2) {
    throw new Error(
      `Invalid value for covenantThreshold: ${covenantThreshold}. It should be greater than or equal to 2.`
    );
  }

  const length = !covenantPks ? 0 : covenantPks.length;
  if (length < 2) {
    throw new Error(
      `covenantPks must have at least 2 elements. Current length: ${length}`
    );
  }

  if (length < covenantThreshold) {
    throw new Error(
      `The length of covenantPks (${length}) is less than the required covenantThreshold (${covenantThreshold}).`
    );
  }

  if (new Set(covenantPks).size < length) {
    throw new Error(`All covenantPks must be unique`);
  }

  return covenantPks
    .map((pk: string) => Buffer.from(pk, 'hex'))
    .sort(Buffer.compare)
    .map((pk: Buffer) => pk.toString('hex')) as string[];
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

  // const keys: string[] = [];
  // const magicFP = displayLeafHash
  //   ? MagicCode.LEAFHASH_DISPLAY_FP
  //   : MagicCode.LEAFHASH_CHECK_ONLY_FP;
  // keys.push(
  //   `[${derivationPath.replace('m/', `${magicFP}/`)}]` +
  //     `${formatKey(leafHash, isTestnet)}`
  // );
  // keys.push(
  //   `[${derivationPath.replace(
  //     'm/',
  //     `${masterFingerPrint}/`
  //   )}]${extendedPublicKey}`
  // );

  // const finalityProviderPk =
  //   _filterFinalityProviders(finalityProviders);
  // keys.push(
  //   `[${derivationPath.replace(
  //     'm/',
  //     `${MagicCode.FINALITY_PUB_FP}/`
  //   )}]${formatKey(finalityProviderPk, isTestnet)}`
  // );

  // const covenantPks = _checkCovenantInfo(covenantThreshold, _covenantPks);

  // const length = covenantPks.length;
  // for (let index = 0; index < length; index++) {
  //   const pk = covenantPks[index];
  //   keys.push(formatKey(pk, isTestnet));
  // }
  // keys.push(formatKey(slashingPkScriptHex.padEnd(64, '0'), isTestnet));
  // keys.push(formatKey(numberToLE(slashingFeeSat), isTestnet));

  // const descriptorTemplate =
  //   `tr(@0/**,and_v(and_v(pk_k(@1/**),and_v(pk_k(@2/**),multi_a(${covenantThreshold},${Array.from(
  //     { length },
  //     (_, index) => index
  //   )
  //     .map((n) => `@${3 + n}/**`)
  //     .join(',')}` +
  //   `,@${3 + length}/**,@${3 + length + 1}/**))),older(${timelockBlocks})))`;

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
  derivationPath = derivationPath
    ? derivationPath
    : `m/86'/${isTestnet ? 1 : 0}'/0'`;

  const {
    leafHash,
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
  const magicFP = displayLeafHash
    ? MagicCode.LEAFHASH_DISPLAY_FP
    : MagicCode.LEAFHASH_CHECK_ONLY_FP;
  keys.push(
    `[${derivationPath.replace('m/', `${magicFP}/`)}]${formatKey(
      leafHash,
      isTestnet
    )}`
  );
  keys.push(
    `[${derivationPath.replace(
      'm/',
      `${masterFingerPrint}/`
    )}]${extendedPublicKey}`
  );

  const finalityProviderPk =
    _filterFinalityProviders(finalityProviders);
  keys.push(
    `[${derivationPath.replace(
      'm/',
      `${MagicCode.FINALITY_PUB_FP}/`
    )}]${formatKey(finalityProviderPk, isTestnet)}`
  );

  const covenantPks = _checkCovenantInfo(covenantThreshold, _covenantPks);

  const length = covenantPks.length;
  for (let index = 0; index < length; index++) {
    const pk = covenantPks[index];
    keys.push(formatKey(pk, isTestnet));
  }

  keys.push(formatKey(numberToLE(unbondingFeeSat), isTestnet));

  const descriptorTemplate =
    `tr(@0/**,and_v(and_v(pk_k(@1/**),and_v(pk_k(@2/**),multi_a(${covenantThreshold},${Array.from(
      { length },
      (_, index) => index
    )
      .map((n) => `@${3 + n}/**`)
      .join(',')}` + `,@${3 + length}/**))),older(${timelockBlocks})))`;

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
  derivationPath = derivationPath
    ? derivationPath
    : `m/86'/${isTestnet ? 1 : 0}'/0'`;

  const { leafHash, timelockBlocks } = params;
  const [masterFingerPrint, extendedPublicKey] = await _prepare(
    transport,
    derivationPath
  );

  const keys: string[] = [];
  const magicFP = displayLeafHash
    ? MagicCode.LEAFHASH_DISPLAY_FP
    : MagicCode.LEAFHASH_CHECK_ONLY_FP;
  keys.push(
    `[${derivationPath.replace('m/', `${magicFP}/`)}]${formatKey(
      leafHash,
      isTestnet
    )}`
  );
  keys.push(
    `[${derivationPath.replace(
      'm/',
      `${masterFingerPrint}/`
    )}]${extendedPublicKey}`
  );

  // tr(@0/**,and_v(pk_k(staker_pk),older(timelock_blocks)))
  const descriptorTemplate = `tr(@0/**,and_v(pk_k(@1/**),older(${timelockBlocks})))`;

  return new WalletPolicy(policyName, descriptorTemplate, keys);
}

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

// const SlashingPathRegexPrefix =
//   /^([a-f0-9]{64}) OP_CHECKSIGVERIFY ([a-f0-9]{64}) OP_CHECKSIGVERIFY ([a-f0-9]{64}) OP_CHECKSIG/;
// const UnbondingPathRegexPrefix =
//   /^([a-f0-9]{64}) OP_CHECKSIGVERIFY ([a-f0-9]{64}) OP_CHECKSIG/;
const TimelockPathRegex1 =
  /^([a-f0-9]{64}) OP_CHECKSIGVERIFY OP_(0|[1-9]|1[0-6]) OP_CHECKSEQUENCEVERIFY$/;
const TimelockPathRegex2 =
  /^([a-f0-9]{64}) OP_CHECKSIGVERIFY ([a-f0-9]{2,6}) OP_CHECKSEQUENCEVERIFY$/;

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
    const [, stakerPK, timelockBlocks] = match;
    return [stakerPK, Number(timelockBlocks).toString(16)];
  }

  match = script.match(TimelockPathRegex2);
  if (!match) {
    return;
  }

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

// /* Example */
// // Method 1: Explicitly pass all required parameters to construct the policy.
// async function testStakingStep1() {
//   const psbt = base64.decode(
//     'cHNidP8BAH0CAAAAAZUPGfxRcPueN3/UdNQC64mF3lAumoEi9Gv6AgvbdVycAAAAAAD/////AsQJAAAAAAAAFgAUW+EmJNCKK0JAldfAciHDNFDRS/EEpgAAAAAAACJRICyVutUKY9E6qBjfjktoZBga2/RyCoiq+OPBI1ugik2fAAAAAAABAStQwwAAAAAAACJRIEOj7UvRXfRV9er0SUNeReHNqaiqtOoEhmW60JCFUoUyQhXAUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsCJtgX5iDHD5SbZ6yF5ZRRSk4qMD/f16u7MthJR1dRt6/15ASDcjS+e/wxPTb3gcKSOMw78kItip2ZWjZHmWPKEsyS4eK0gH5MjVzLmTKwzVprRw9vwQTgsO3dPz7BTO5sx1MKna/mtIAruBQmxbbccmZI4pIJ9uUVSaFmxPJVIerRnJTV8mp8lrCARPDoyqdMgtyGQoEoCCg2zl27zaXJnMljpo4o2Tz3DsLogF5Ic8VbMtOc9Qo+ZbtEbJFMT434nyXisTSzCHspGcuS6IDu5PfyLYYh9dx82MOmmPpfLr8/MeFVqR034OjGg74mcuiBAr69HxP+lbehkENjke6ortvBLYE9OokMjc33cP+CS37ogeacf/XHFA+8uL5G8z8j82nlG9GU87w2fPd4geV7zufC6INIfr3jGdRoNOOa9gCi5B/8H6ahppD/IN9az+N/2EZo2uiD1GZ764/KLuCR2Fjp+RYx61EXZv/sGgtENO9sstB+Ojrog+p2ILUX0BgvbgEIYOCjNh1RPHqmXOA5YbKt31f1phze6VpzAARcgUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsAAAAA='
//   );

//   const transport = await getLedgerTransport();

//   const leafHash = computeLeafHash(psbt);
//   const finalityProviderPk =
//     '1f93235732e64cac33569ad1c3dbf041382c3b774fcfb0533b9b31d4c2a76bf9';
//   const covenantPks = [
//     '0aee0509b16db71c999238a4827db945526859b13c95487ab46725357c9a9f25',
//     '113c3a32a9d320b72190a04a020a0db3976ef36972673258e9a38a364f3dc3b0',
//     '17921cf156ccb4e73d428f996ed11b245313e37e27c978ac4d2cc21eca4672e4',
//     '3bb93dfc8b61887d771f3630e9a63e97cbafcfcc78556a474df83a31a0ef899c',
//     '40afaf47c4ffa56de86410d8e47baa2bb6f04b604f4ea24323737ddc3fe092df',
//     '79a71ffd71c503ef2e2f91bccfc8fcda7946f4653cef0d9f3dde20795ef3b9f0',
//     'd21faf78c6751a0d38e6bd8028b907ff07e9a869a43fc837d6b3f8dff6119a36',
//     'f5199efae3f28bb82476163a7e458c7ad445d9bffb0682d10d3bdb2cb41f8e8e',
//     'fa9d882d45f4060bdb8042183828cd87544f1ea997380e586cab77d5fd698737',
//   ];

//   const params = {
//     leafHash,
//     finalityProviderPk,
//     covenantThreshold: 6,
//     covenantPks,
//   };

//   const policy = await slashingPathPolicy({
//     policyName: 'Step 1: slashing consent',
//     transport,
//     params,
//     derivationPath: `m/86'/1'/0'`,
//     isTestnet: true,
//   });

//   await signPsbt({ transport, psbt, policy });
// }

// // Method 2: Automatically parse the policy from the content of the provided PSBT.
// async function testStakingStep2() {
//   const psbtBase64 =
//     'cHNidP8BAH0CAAAAAZUPGfxRcPueN3/UdNQC64mF3lAumoEi9Gv6AgvbdVycAAAAAAD/////AsQJAAAAAAAAFgAUW+EmJNCKK0JAldfAciHDNFDRS/EEpgAAAAAAACJRICyVutUKY9E6qBjfjktoZBga2/RyCoiq+OPBI1ugik2fAAAAAAABAStQwwAAAAAAACJRIEOj7UvRXfRV9er0SUNeReHNqaiqtOoEhmW60JCFUoUyQhXAUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsCJtgX5iDHD5SbZ6yF5ZRRSk4qMD/f16u7MthJR1dRt6/15ASDcjS+e/wxPTb3gcKSOMw78kItip2ZWjZHmWPKEsyS4eK0gH5MjVzLmTKwzVprRw9vwQTgsO3dPz7BTO5sx1MKna/mtIAruBQmxbbccmZI4pIJ9uUVSaFmxPJVIerRnJTV8mp8lrCARPDoyqdMgtyGQoEoCCg2zl27zaXJnMljpo4o2Tz3DsLogF5Ic8VbMtOc9Qo+ZbtEbJFMT434nyXisTSzCHspGcuS6IDu5PfyLYYh9dx82MOmmPpfLr8/MeFVqR034OjGg74mcuiBAr69HxP+lbehkENjke6ortvBLYE9OokMjc33cP+CS37ogeacf/XHFA+8uL5G8z8j82nlG9GU87w2fPd4geV7zufC6INIfr3jGdRoNOOa9gCi5B/8H6ahppD/IN9az+N/2EZo2uiD1GZ764/KLuCR2Fjp+RYx61EXZv/sGgtENO9sstB+Ojrog+p2ILUX0BgvbgEIYOCjNh1RPHqmXOA5YbKt31f1phze6VpzAARcgUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsAAAAA=';

//   const transport = await getLedgerTransport();

//   const policy = await tryParsePsbt(transport, psbtBase64, true);

//   await signPsbt({ transport, psbt: psbtBase64, policy: policy! });
// }

// async function testStakingTx() {
//   const psbt = base64.decode('');

//   const transport = await getLedgerTransport();

//   const finalityProviderPk =
//     '1f93235732e64cac33569ad1c3dbf041382c3b774fcfb0533b9b31d4c2a76bf9';
//   const covenantPks = [
//     '0aee0509b16db71c999238a4827db945526859b13c95487ab46725357c9a9f25',
//     '113c3a32a9d320b72190a04a020a0db3976ef36972673258e9a38a364f3dc3b0',
//     '17921cf156ccb4e73d428f996ed11b245313e37e27c978ac4d2cc21eca4672e4',
//     '3bb93dfc8b61887d771f3630e9a63e97cbafcfcc78556a474df83a31a0ef899c',
//     '40afaf47c4ffa56de86410d8e47baa2bb6f04b604f4ea24323737ddc3fe092df',
//     '79a71ffd71c503ef2e2f91bccfc8fcda7946f4653cef0d9f3dde20795ef3b9f0',
//     'd21faf78c6751a0d38e6bd8028b907ff07e9a869a43fc837d6b3f8dff6119a36',
//     'f5199efae3f28bb82476163a7e458c7ad445d9bffb0682d10d3bdb2cb41f8e8e',
//     'fa9d882d45f4060bdb8042183828cd87544f1ea997380e586cab77d5fd698737',
//   ];

//   const params = {
//     timelockBlocks: 64000,
//     finalityProviderPk,
//     covenantThreshold: 6,
//     covenantPks,
//   };

//   const policy = await stakingTxPolicy({
//     policyName: 'Staking transaction',
//     transport,
//     params,
//     derivationPath: `m/86'/1'/0'`,
//     isTestnet: true,
//   });

//   await signPsbt({ transport, psbt, policy });
// }
