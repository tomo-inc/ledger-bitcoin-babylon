import AppClient, { PartialSignature } from './lib/appClient';

import type {
  SlashingPolicy,
  SlashingParams,
  StakingTxPolicy,
  StakingTxParams,
  TimelockPolicy,
  TimelockParams,
  UnbondingPolicy,
  UnbondingParams,
} from './lib/babylon';

import type {
  AddressType,
  MessageSigningProtocols,
  SignedMessage,
} from './lib/babylon/types';

import {
  DefaultDescriptorTemplate,
  DefaultWalletPolicy,
  WalletPolicy,
} from './lib/policy';

import {
  computeLeafHash,
  signMessage,
  tryParsePsbt,
  signPsbt,
  slashingPathPolicy,
  stakingTxPolicy,
  timelockPathPolicy,
  unbondingPathPolicy,
} from './lib/babylon';

import { PsbtV2 } from './lib/psbtv2';

export {
  AddressType,
  SlashingPolicy,
  SlashingParams,
  StakingTxPolicy,
  StakingTxParams,
  TimelockPolicy,
  TimelockParams,
  UnbondingPolicy,
  UnbondingParams,
  MessageSigningProtocols,
  SignedMessage,
  DefaultDescriptorTemplate,
  DefaultWalletPolicy,
  WalletPolicy,
};

export {
  AppClient,
  PsbtV2,
  PartialSignature,
  signMessage,
  computeLeafHash,
  slashingPathPolicy,
  unbondingPathPolicy,
  timelockPathPolicy,
  stakingTxPolicy,
  signPsbt,
  tryParsePsbt,
};

export default AppClient;
