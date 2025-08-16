import { encodeStakingTxPolicyToTLV, 
         encodeSlashingTxPolicyToTLV,
         encodeUnbondPolicyToTLV,
         encodeWithdrawPolicyToTLV } from './data';

import AppClient from '../appClient';
import Transport from '@ledgerhq/hw-transport';
import { WalletPolicy } from '../policy';

async function _prepare(
  transport: Transport,
  derivationPath: string
): Promise<string[]> {
  const app = new AppClient(transport);
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(derivationPath);

  return [masterFingerPrint, extendedPublicKey];
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
  isTestnet = false,
}: {
  policyName?: SlashingPolicy;
  transport: Transport;
  params: SlashingParams;
  derivationPath?: string;
  displayLeafHash?: boolean;
  isTestnet?: boolean;
}): Promise<WalletPolicy> {
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
  const app = new AppClient(transport);
  try {
    await app.dataPrepare(tlvBuffer);
  } catch (error) {
    console.error('Error in dataPrepare:', error);
    throw error;
  }

  return new WalletPolicy(policyName, descriptorTemplate, keys);

}

export type SignMessagePolicy = undefined | 'Sign message';
export type SignMessageParams = {
  leafHash: Buffer;
  timelockBlocks: number;
};

export async function signMessagePathPolicy({
  policyName = 'Sign message',
  transport,
  params,
  derivationPath,
  isTestnet = false,
}: {
  policyName?: SignMessagePolicy;
  transport: Transport;
  params: TimelockParams;
  derivationPath?: string;
  displayLeafHash?: boolean;
  isTestnet?: boolean;
}): Promise<WalletPolicy> {
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
  const app = new AppClient(transport);
  try {
    await app.dataPrepare(tlvBuffer);
  } catch (error) {
    console.error('Error in dataPrepare:', error);
    throw error;
  }

  return new WalletPolicy(policyName, descriptorTemplate, keys);

}