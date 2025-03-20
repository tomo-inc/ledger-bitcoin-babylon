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
  derivationPath = `m/84'/0'/0'`,
  isTestnet = false,
}: {
  message: string;
  app: AppClient;
  derivationPath: string;
  isTestnet: boolean;
}): Promise<SignedMessage> {
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(derivationPath);
  const { publicKey, witnessScript } = getNativeSegwitAccountDataFromXpub(
    extendedPublicKey,
    0,
    isTestnet
  );

  const inputDerivation: Bip32Derivation = {
    path: `${derivationPath}/0/0`,
    pubkey: publicKey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
  };

  const accountPolicy = new WalletPolicy(
    'Sign message',
    'wpkh(@0/**)',
    [
      `[${derivationPath.replace(
        'm/',
        `${masterFingerPrint}/`
      )}]${extendedPublicKey}`,
    ]
  );

  return createMessageSignature(
    app,
    accountPolicy,
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
  derivationPath = `m/86'/0'/0'`,
  isTestnet = false,
}: {
  message: string;
  app: AppClient;
  derivationPath: string;
  isTestnet: boolean;
}): Promise<SignedMessage> {
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(derivationPath);
  const { internalPubkey, taprootScript } = getTaprootAccountDataFromXpub(
    extendedPublicKey,
    0,
    isTestnet
  );

  // Need to update input derivation path so the ledger can recognize the inputs to sign
  const inputDerivation: TapBip32Derivation = {
    path: `${derivationPath}/0/0`,
    pubkey: internalPubkey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
    leafHashes: [],
  };

  const accountPolicy = new WalletPolicy('Sign message', 'tr(@0/**)', [
    `[${derivationPath.replace(
      'm/',
      `${masterFingerPrint}/`
    )}]${extendedPublicKey}`,
  ]);

  return createMessageSignature(
    app,
    accountPolicy,
    message,
    taprootScript,
    {
      tapBip32Derivation: [inputDerivation],
      tapInternalKey: internalPubkey,
    },
    false
  );
}
