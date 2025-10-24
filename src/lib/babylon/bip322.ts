import * as ecc from '@bitcoinerlab/secp256k1';
import {
  crypto,
  Psbt,
  Transaction,
  initEccLib,
  networks,
  payments,
} from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import { encode } from 'varuint-bitcoin';

import AppClient, { WalletPolicy } from '../..';
import {
  MessageSigningProtocols,
  SignedMessage,
  Bip32Derivation,
  TapBip32Derivation,
} from './types';
import Transport from '@ledgerhq/hw-transport';
import { getAddressTypeFromPath } from './utils';
import { AddressType } from './types'
import { signMessagePathPolicy } from './prepare';

const bip32 = BIP32Factory(ecc);
const encodeVarString = (b: Buffer) => Buffer.concat([encode(b.byteLength), b]);
const DUMMY_INPUT_HASH = Buffer.from(
  '0000000000000000000000000000000000000000000000000000000000000000',
  'hex'
);
const DUMMY_INPUT_INDEX = 0xffffffff;
const DUMMY_INPUT_SEQUENCE = 0;
type PsbtInput = Parameters<Psbt['addInput']>[0];


export function bip0322Hash(message: string) {
  const { sha256 } = crypto;
  const tag = 'BIP0322-signed-message';
  const tagHash = sha256(Buffer.from(tag));
  const result = sha256(
    Buffer.concat([tagHash, tagHash, Buffer.from(message)])
  );
  return result.toString('hex');
}

const createMessageSignature = async (
  app: AppClient,
  accountPolicy: WalletPolicy,
  message: string,
  witnessScript: Buffer,
  inputArgs:
    | Pick<PsbtInput, 'bip32Derivation'>
    | Pick<PsbtInput, 'tapBip32Derivation' | 'tapInternalKey'>,
  isSegwit: boolean
): Promise<SignedMessage> => {
  const scriptSig = Buffer.concat([
    Buffer.from('0020', 'hex'),
    Buffer.from(bip0322Hash(message), 'hex'),
  ]);
  const txToSpend = new Transaction();
  txToSpend.version = 0;
  txToSpend.addInput(
    DUMMY_INPUT_HASH,
    DUMMY_INPUT_INDEX,
    DUMMY_INPUT_SEQUENCE,
    scriptSig
  );
  txToSpend.addOutput(witnessScript, 0);
  const psbtToSign = new Psbt();
  psbtToSign.setVersion(0);
  psbtToSign.addInput({
    hash: txToSpend.getHash(),
    index: 0,
    sequence: 0,
    witnessUtxo: {
      script: witnessScript,
      value: 0,
    },
    ...inputArgs,
  });
  psbtToSign.addOutput({ script: Buffer.from('6a', 'hex'), value: 0 });
  const signatures = await app.signPsbt(
    psbtToSign.toBase64(),
    accountPolicy,
    null
  );
  for (const signature of signatures) {
    if (isSegwit) {
      psbtToSign.updateInput(signature[0], {
        partialSig: [signature[1]],
      });
    } else {
      psbtToSign.updateInput(signature[0], {
        tapKeySig: signature[1].signature,
      });
    }
  }
  psbtToSign.finalizeAllInputs();
  const txToSign = psbtToSign.extractTransaction();
  const len = encode(txToSign.ins[0].witness.length);
  const result = Buffer.concat([
    len,
    ...txToSign.ins[0].witness.map((w) => encodeVarString(w)),
  ]);
  const signature = result.toString('base64');
  return {
    signature,
    protocol: MessageSigningProtocols.BIP322,
  };
};

function getPublicKeyFromXpubAtIndex(
  xpub: string,
  index: number,
  isTestnet: boolean
): Buffer {
  const btcNetwork = isTestnet ? networks.testnet : networks.bitcoin;
  const { publicKey } = bip32
    .fromBase58(xpub, btcNetwork)
    .derivePath(`0/${index}`);
  return publicKey;
}

function getNativeSegwitAccountDataFromXpub(
  xpub: string,
  index: number,
  isTestnet = false
): {
  publicKey: Buffer;
  address: string;
  witnessScript: Buffer;
} {
  initEccLib(ecc);

  const publicKey = getPublicKeyFromXpubAtIndex(xpub, index, isTestnet);
  const btcNetwork = isTestnet ? networks.testnet : networks.bitcoin;
  const p2wpkh = payments.p2wpkh({ pubkey: publicKey, network: btcNetwork });
  const address = p2wpkh.address;

  if (!address) {
    throw new Error('Address is null');
  }

  if (!p2wpkh.output) {
    throw new Error('p2wpkh output is null');
  }

  return {
    publicKey,
    address,
    witnessScript: p2wpkh.output,
  };
}

export async function createSegwitBip322Signature({
  message,
  app,
  derivationPath,
  isTestnet = false
}: {
  message: string;
  app: AppClient;
  derivationPath: string;
  isTestnet: boolean;
}): Promise<SignedMessage> {
  const transport = app.transport;
  const masterFingerPrint = await app.getMasterFingerprint();
  console.log("Master Fingerprint:", masterFingerPrint);
  console.log("Derivation Path:", derivationPath);
  const threeLevelPath = derivationPath.split('/').slice(0, 4).join('/');
  console.log("Three Level Path:", threeLevelPath);
  const extendedPublicKey = await app.getExtendedPubkey(threeLevelPath);
  console.log("Extended Public Key:", extendedPublicKey);
  console.log("extendedPublicKey:", extendedPublicKey);
  const { publicKey, witnessScript } = getNativeSegwitAccountDataFromXpub(
    extendedPublicKey,
    0,
    isTestnet
  );
  console.log("createSegwitBip322Signature Public Key:", publicKey.toString('hex'));
  const inputDerivation: Bip32Derivation = {
    path: derivationPath,
    pubkey: publicKey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
  };
  console.log("Input Derivation:", inputDerivation);
   const params = {
      message:message,
      pubkey:Buffer.from(witnessScript.slice(2)),
    };
  const policy = await signMessagePathPolicy({
      transport,
      params,
      derivationPath,
      isTestnet
    });
  console.log("Policy created");
  console.log("policy:", policy);
  return createMessageSignature(
    app,
    policy,
    message,
    witnessScript,
    {
      bip32Derivation: [inputDerivation],
    },
    true
  );
}

function getTaprootAccountDataFromXpub(
  xpub: string,
  index: number,
  isTestnet = false
): {
  publicKey: Buffer;
  address: string;
  internalPubkey: Buffer;
  taprootScript: Buffer;
} {
  initEccLib(ecc);

  const publicKey = getPublicKeyFromXpubAtIndex(xpub, index, isTestnet);
  const p2tr = payments.p2tr({
    internalPubkey: publicKey.slice(1),
    network: isTestnet ? networks.testnet : networks.bitcoin,
  });

  if (!p2tr.output || !p2tr.address || !p2tr.internalPubkey) {
    throw new Error('p2tr output, address or internalPubkey is null');
  }

  return {
    publicKey,
    address: p2tr.address,
    internalPubkey: p2tr.internalPubkey,
    taprootScript: p2tr.output,
  };
}


export async function createTaprootBip322Signature({
  message,
  app,
  derivationPath,
  isTestnet = false
}: {
  message: string;
  app: AppClient;
  derivationPath: string;
  isTestnet?: boolean;
}): Promise<SignedMessage> {
  const transport = app.transport;
  const masterFingerPrint = await app.getMasterFingerprint();
  const threeLevelPath = derivationPath.split('/').slice(0, 4).join('/');
  const extendedPublicKey = await app.getExtendedPubkey(threeLevelPath);
  const { internalPubkey, taprootScript } = getTaprootAccountDataFromXpub(
    extendedPublicKey,
    0,
    isTestnet
  );
  console.log("createTaprootBip322Signature Internal Public Key:", internalPubkey.toString('hex'));
  const inputDerivation: TapBip32Derivation = {
    path: derivationPath,
    pubkey: internalPubkey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
    leafHashes: [],
  };

  const params = {
      message:message,
      pubkey:Buffer.from(taprootScript.slice(2)),
    };

  const policy = await signMessagePathPolicy({
      transport,
      params,
      derivationPath,
      isTestnet
    });
  return createMessageSignature(
    app,
    policy,
    message,
    taprootScript,
    {
      tapBip32Derivation: [inputDerivation],
      tapInternalKey: internalPubkey,
    },
    false
  );
}


export async function signMessageBIP322({
  transport,
  message,
  derivationPath,
  isTestnet = false
}: {
  transport: Transport;
  message: string;
  derivationPath: string;
  isTestnet?: boolean;
}): Promise<SignedMessage> {
  console.log("Derivation Path:", derivationPath);
  const addressType = getAddressTypeFromPath(derivationPath);
  console.log("Address Type:", addressType);
  if (!addressType) {
    throw new Error('The derivation path is not valid.');
  }
  const app = new AppClient(transport);
  if (addressType === AddressType.p2tr) {
    console.log("Creating Taproot BIP322 Signature");
    return createTaprootBip322Signature({
      message,
      app,
      derivationPath,
      isTestnet
    });
  }
  console.log("12 Creating Segwit BIP322 Signature");
  return createSegwitBip322Signature({
    message,
    app,
    derivationPath,
    isTestnet
  });
}