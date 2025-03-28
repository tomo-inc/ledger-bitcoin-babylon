export enum AddressType {
  p2pkh = 'p2pkh',
  p2sh = 'p2sh',
  p2wpkh = 'p2wpkh',
  p2wsh = 'p2wsh',
  p2tr = 'p2tr',
}

export enum MessageSigningProtocols {
  ECDSA = 'ECDSA',
  BIP322 = 'BIP322',
}

export type SignedMessage = {
  signature: string;
  protocol: MessageSigningProtocols;
};

export type Bip32Derivation = {
  masterFingerprint: Buffer;
  path: string;
  pubkey: Buffer;
};

export interface TapBip32Derivation extends Bip32Derivation {
  leafHashes: Buffer[];
}

export enum MagicCode {
  LEAFHASH_DISPLAY_FP = '69846d00',
  LEAFHASH_CHECK_ONLY_FP = '3b9f9680',
  FINALITY_PUB_FP = 'ff119473',
  BIP322_MESSAGE_FP = '83871619',
  BIP322_TAP_PUBKEY_FP = '25270417',
}
