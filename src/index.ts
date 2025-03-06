import AppClient, { PartialSignature } from './lib/appClient';
import {
  computeLeafHash,
  signMessage,
  signMessageECDSA,
  signMessageBIP322,
  signPsbt,
  slashingPathPolicy,
  stakingTxPolicy,
  timelockPathPolicy,
  tryParsePsbt,
  unbondingPathPolicy,
} from './lib/babylon';
import {
  DefaultDescriptorTemplate,
  DefaultWalletPolicy,
  WalletPolicy,
} from './lib/policy';
import { PsbtV2 } from './lib/psbtv2';

export {
  AppClient,
  PsbtV2,
  DefaultDescriptorTemplate,
  DefaultWalletPolicy,
  PartialSignature,
  WalletPolicy,
  signMessage,
  signMessageECDSA,
  signMessageBIP322,
  computeLeafHash,
  slashingPathPolicy,
  unbondingPathPolicy,
  timelockPathPolicy,
  stakingTxPolicy,
  signPsbt,
  tryParsePsbt,
};

import {
  AddressType,
  MessageSigningProtocols,
  SignedMessage,
} from './lib/types';
export { AddressType, MessageSigningProtocols, SignedMessage };

export default AppClient;
