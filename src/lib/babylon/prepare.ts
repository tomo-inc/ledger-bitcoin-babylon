import { encodeStakingTxPolicyToTLV, 
         encodeSlashingTxPolicyToTLV,
         encodeUnbondPolicyToTLV,
         encodeWithdrawPolicyToTLV,
         encodeSignMessagePolicyToTLV,
         encodeExpansionPolicyToTLV } from './data';

import AppClient from '../appClient';
import Transport from '@ledgerhq/hw-transport';
import { WalletPolicy } from '../policy';
import { isFullFiveLevelPath, getAddressTypeFromPath } from './utils';
import { AddressType } from './types'

async function _prepare(
  transport: Transport,
  derivationPath: string
): Promise<string[]> {
  const app = new AppClient(transport);
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(derivationPath);

  return [masterFingerPrint, extendedPublicKey];
}

export type SlashingParams = {
  timelockBlocks: number;
  finalityProviders: string[];
  covenantThreshold: number;
  covenantPks: string[];
  slashingPkScriptHex: string;
  slashingFeeSat: number;
};

export async function slashingPathPolicy({
  transport,
  params,
  derivationPath,
}: {
  transport: Transport;
  params: SlashingParams;
  derivationPath: string;
}): Promise<WalletPolicy> {
  const {
    timelockBlocks,
    finalityProviders,
    covenantThreshold,
    covenantPks: _covenantPks, 
    slashingPkScriptHex,
    slashingFeeSat,
  } = params;
  if (!isFullFiveLevelPath(derivationPath)) {
        throw new Error('The derivation path should be a full five-level path.');
  }

  const threeLevelPath = derivationPath.split('/').slice(0, 4).join('/');
  const [masterFingerPrint, extendedPublicKey] = await _prepare(
    transport,
    threeLevelPath
  );
  
  const addressType = getAddressTypeFromPath(derivationPath);
  let descriptorTemplate;
  if(addressType === AddressType.p2wpkh) {
    descriptorTemplate = "wpkh(@0/**)";
  } else if(addressType === AddressType.p2tr) {
    descriptorTemplate = "tr(@0/**)";
  } else {
    throw new Error('Only p2tr and segwit address types are supported for slashing transactions.');
  }
   const keys: string[] = [];
   keys.push(
    `[${threeLevelPath.replace(
      'm/',
      `${masterFingerPrint}/`
    )}]${extendedPublicKey}`
  );

   const tlvBuffer = encodeSlashingTxPolicyToTLV(
    derivationPath,
    timelockBlocks,
    finalityProviders,
    covenantThreshold,
    _covenantPks,
    slashingPkScriptHex,
    slashingFeeSat
  );
  const app = new AppClient(transport);
  try {
    await app.dataPrepare(tlvBuffer);
  } catch (error) {
    console.error('Error in dataPrepare:', error);
    throw error;
  }

  return new WalletPolicy('', descriptorTemplate, keys);
}

export type StakingTxParams = {
  timelockBlocks: number;
  finalityProviders: string[];
  covenantThreshold: number;
  covenantPks: string[];
};

export async function stakingTxPolicy({
  transport,
  params,
  derivationPath
}: {
  transport: Transport;
  params: StakingTxParams;
  derivationPath: string;
}): Promise<WalletPolicy> {
  if (!isFullFiveLevelPath(derivationPath)) {
        throw new Error('The derivation path should be a full five-level path.');
  }
  const addressType = getAddressTypeFromPath(derivationPath);
  const threeLevelPath = derivationPath.split('/').slice(0, 4).join('/');
  const [masterFingerPrint, extendedPublicKey] = await _prepare(
    transport,
    threeLevelPath
  );
  const keys: string[] = [];
  let descriptorTemplate;
  if(addressType === AddressType.p2wpkh) {
    descriptorTemplate = "wpkh(@0/**)";
  } else if(addressType === AddressType.p2tr) {
    descriptorTemplate = "tr(@0/**)";
  } else {
    throw new Error('Only p2tr and segwit address types are supported for staking transactions.');
  }
   keys.push(
    `[${threeLevelPath.replace(
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
    derivationPath,
    timelockBlocks,
    finalityProviders,
    covenantThreshold,
    _covenantPks || []
  );
  const app = new AppClient(transport);
  try {
    await app.dataPrepare(tlvBuffer);
  } catch (error) {
    console.error('Error in dataPrepare:', error);
    throw error;
  }

  return new WalletPolicy('', descriptorTemplate, keys);
}

export type UnbondingParams = {
  timelockBlocks: number;
  finalityProviders: string[];
  covenantThreshold: number;
  covenantPks?: string[];
  unbondingFeeSat: number;
};

export async function unbondingPathPolicy({
  transport,
  params,
  derivationPath,
}: {
  transport: Transport;
  params: UnbondingParams;
  derivationPath?: string;
  displayLeafHash?: boolean;
}): Promise<WalletPolicy> {
  const {
    timelockBlocks,
    finalityProviders,
    covenantThreshold,
    covenantPks: _covenantPks,
    unbondingFeeSat,
  } = params;
  if (!isFullFiveLevelPath(derivationPath)) {
        throw new Error('The derivation path should be a full five-level path.');
  }

  const threeLevelPath = derivationPath.split('/').slice(0, 4).join('/');
  const [masterFingerPrint, extendedPublicKey] = await _prepare(
    transport,
    threeLevelPath
  );
  const addressType = getAddressTypeFromPath(derivationPath);
  let descriptorTemplate;
  if(addressType === AddressType.p2wpkh) {
    descriptorTemplate = "wpkh(@0/**)";
  } else if(addressType === AddressType.p2tr) {
    descriptorTemplate = "tr(@0/**)";
  } else {
    throw new Error('Only p2tr and segwit address types are supported for slashing transactions.');
  }
  const keys: string[] = [];
   keys.push(
    `[${threeLevelPath.replace(
      'm/',
      `${masterFingerPrint}/`
    )}]${extendedPublicKey}`
  );

   const tlvBuffer = encodeUnbondPolicyToTLV(
    derivationPath,
    timelockBlocks,
    finalityProviders,
    covenantThreshold,
    _covenantPks,
    unbondingFeeSat
  );
  const app = new AppClient(transport);
  try {
    await app.dataPrepare(tlvBuffer);
  } catch (error) {
    console.error('Error in dataPrepare:', error);
    throw error;
  }

  return new WalletPolicy('', descriptorTemplate, keys);
}

export type WithdrawParams = {
  timelockBlocks: number;
};

export async function withdrawPathPolicy({
  transport,
  params,
  derivationPath,
}: {
  transport: Transport;
  params: WithdrawParams;
  derivationPath?: string;
  displayLeafHash?: boolean;
  isTestnet?: boolean;
}): Promise<WalletPolicy> {
  const {
    timelockBlocks,
  } = params;
  if (!isFullFiveLevelPath(derivationPath)) {
      throw new Error('The derivation path should be a full five-level path.');
  }
  const threeLevelPath = derivationPath.split('/').slice(0, 4).join('/');
  const [masterFingerPrint, extendedPublicKey] = await _prepare(
    transport,
    threeLevelPath
  );
  const addressType = getAddressTypeFromPath(derivationPath);
  let descriptorTemplate;
  if(addressType === AddressType.p2wpkh) {
    descriptorTemplate = "wpkh(@0/**)";
  } else if(addressType === AddressType.p2tr) {
    descriptorTemplate = "tr(@0/**)";
  } else {
    throw new Error('Only p2tr and segwit address types are supported for slashing transactions.');
  }

  const keys: string[] = [];
   keys.push(
    `[${threeLevelPath.replace(
      'm/',
      `${masterFingerPrint}/`
    )}]${extendedPublicKey}`
  );

   const tlvBuffer = encodeWithdrawPolicyToTLV(
    derivationPath,
    timelockBlocks
  );
  const app = new AppClient(transport);
  try {
    await app.dataPrepare(tlvBuffer);
  } catch (error) {
    console.error('Error in dataPrepare:', error);
    throw error;
  }

  return new WalletPolicy('', descriptorTemplate, keys);

}

export type SignMessageParams = {
  message: string;
  pubkey: Buffer;
};

export async function signMessagePathPolicy({
  transport,
  params,
  derivationPath
}: {
  transport: Transport;
  params: SignMessageParams;
  derivationPath: string;
  isTestnet?: boolean;
}): Promise<WalletPolicy> {
  if (!isFullFiveLevelPath(derivationPath)) {
        throw new Error('The derivation path should be a full five-level path.');
  }
  const threeLevelPath = derivationPath.split('/').slice(0, 4).join('/');
  const {
    message,
    pubkey,
  } = params;
  const [masterFingerPrint, extendedPublicKey] = await _prepare(
    transport,
    threeLevelPath
  );
  const keys: string[] = [];
 
  const addressType = getAddressTypeFromPath(derivationPath);
  let descriptorTemplate;
  if(addressType === AddressType.p2wpkh) {
    descriptorTemplate = "wpkh(@0/**)";
  } else if(addressType === AddressType.p2tr) {
    descriptorTemplate = "tr(@0/**)";
  } else {
    throw new Error('Only p2tr and segwit address types are supported for slashing transactions.');
  }
  console.log("Derivation Path for Sign Message Policy:", derivationPath);
  console.log("descriptorTemplate:", descriptorTemplate);
  
  keys.push(
    `[${threeLevelPath.replace(
      'm/',
      `${masterFingerPrint}/`
    )}]${extendedPublicKey}`
  );
  if (message.length == 0 || message.length > 128) {
      throw new Error('The message should be a non-empty string with a maximum length of 128 characters.');
  }
  console.log("message:", message);
  const tlvBuffer = encodeSignMessagePolicyToTLV(
    derivationPath,
    Buffer.from(message),
    pubkey
  );
  const app = new AppClient(transport);
  try {
    await app.dataPrepare(tlvBuffer);
  } catch (error) {
    console.error('Error in dataPrepare:', error);
    throw error;
  }
  return new WalletPolicy('', descriptorTemplate, keys);

}

export async function expansionTxPolicy({
  transport,
  params,
  derivationPath
}: {
  transport: Transport;
  params: StakingTxParams;
  derivationPath: string;
}): Promise<WalletPolicy> {
  if (!isFullFiveLevelPath(derivationPath)) {
        throw new Error('The derivation path should be a full five-level path.');
  }
  const addressType = getAddressTypeFromPath(derivationPath);
  const threeLevelPath = derivationPath.split('/').slice(0, 4).join('/');
  const [masterFingerPrint, extendedPublicKey] = await _prepare(
    transport,
    threeLevelPath
  );
  const keys: string[] = [];
  let descriptorTemplate;
  if(addressType === AddressType.p2wpkh) {
    descriptorTemplate = "wpkh(@0/**)";
  } else if(addressType === AddressType.p2tr) {
    descriptorTemplate = "tr(@0/**)";
  } else {
    throw new Error('Only p2tr and segwit address types are supported for staking transactions.');
  }
   keys.push(
    `[${threeLevelPath.replace(
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

  const tlvBuffer = encodeExpansionPolicyToTLV(
    derivationPath,
    timelockBlocks,
    finalityProviders,
    covenantThreshold,
    _covenantPks || []
  );
  const app = new AppClient(transport);
  try {
    await app.dataPrepare(tlvBuffer);
  } catch (error) {
    console.error('Error in dataPrepare:', error);
    throw error;
  }

  return new WalletPolicy('', descriptorTemplate, keys);
}