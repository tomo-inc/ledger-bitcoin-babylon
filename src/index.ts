import AppClient, { PartialSignature } from './lib/appClient';

import type {
  SlashingParams,
  StakingTxParams,
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
  signMessage,
  signPsbt,
  slashingPathPolicy,
  stakingTxPolicy,
  withdrawPathPolicy,
  unbondingPathPolicy,
  expansionTxPolicy,
} from './lib/babylon';

import { getBbnVersion } from './lib/babylon/prepare';

import { PsbtV2 } from './lib/psbtv2';

export {
  AddressType,
  SlashingParams,
  StakingTxParams,
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
  slashingPathPolicy,
  unbondingPathPolicy,
  withdrawPathPolicy,
  stakingTxPolicy,
  expansionTxPolicy,
  signPsbt,
  signMessage,
  getBbnVersion,
};

export default AppClient;
