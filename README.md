# Ledger Babylon Application Client

## Overview

A library designed for seamless integration with the Ledger Babylon application. It's a fork of [ledger-bitcoin](https://www.npmjs.com/package/ledger-bitcoin).

## Install

To add the Ledger Babylon Application Client to your project, you can use either Yarn or npm:

```bash
$ yarn add ledger-bitcoin-babylon
```

Or, if you prefer using npm:

```bash
$ npm install ledger-bitcoin-babylon
```

## Building

After installing the package, build the project with the following commands:

```bash
$ yarn

$ yarn build
```

## Getting Started

Begin by importing the necessary modules and types from the package along with a compatible Ledger transport (for example, the WebUSB transport). The sample code below demonstrates the basic setup:

```javascript
import Transport from '@ledgerhq/hw-transport-webusb';
import AppClient, {
  DefaultWalletPolicy,
  WalletPolicy,
  computeLeafHash,
  signMessage,
  signPsbt,
  tryParsePsbt,
  slashingPathPolicy,
  stakingTxPolicy,
} from 'ledger-bitcoin-babylon';

import type {
  SignedMessage,
  SlashingParams,
  UnbondingParams,
  TimelockParams,
  StakingTxParams,
} from 'ledger-bitcoin-babylon';
```


### Get Wallet Information

The following example demonstrates how to retrieve key wallet details such as the master key fingerprint, extended public key, and a derived wallet address. You must specify the appropriate derivation path and indicate whether you are working with a testnet.

```javascript
const DERIVATION_PATH = `m/86'/1'/0'`;
const IS_TESTNET = true;

async function getWalletInfo(transport: Transport) {
  const app = new AppClient(transport);

  const fpr = await app.getMasterFingerprint();
  console.log('Master key fingerprint:', fpr);

  const extendedPubkey = await app.getExtendedPubkey(DERIVATION_PATH);
  console.log('Extended public key:', extendedPubkey);

  const accountPolicy = new DefaultWalletPolicy(
    'tr(@0/**)',
    `[${DERIVATION_PATH.replace('m/', `${fpr}/`)}]${extendedPubkey}`
  );
  const address = await app.getWalletAddress(
    accountPolicy,
    null,
    0,
    0,
    true // show address on the wallet's screen
  );

  console.log('Wallet address:', address);
}
```


### Sign Staking Script

For signing staking script transactions, you must build a specific wallet policy that includes parameters such as the finality provider public key, covenant public keys, and a threshold value. Detailed documentation for staking scripts can be found on the [Babylon GitHub repository](https://github.com/babylonlabs-io/babylon/blob/main/docs/staking-script.md).

There are two methods available for signing a staking script:

#### Method 1: Explicitly Pass All Required Parameters to Construct the Policy

This method allows for full control over the wallet policy by explicitly providing all necessary parameters. It computes the leaf hash from the PSBT and sets the required public keys and threshold values.

```javascript
async function testSlashingScript1(transport: Transport) {
  const psbt = base64.decode(
    'cHNidP8BAH0CAAAAAZUPGfxRcPueN3/UdNQC64mF3lAumoEi9Gv6AgvbdVycAAAAAAD/////AsQJAAAAAAAAFgAUW+EmJNCKK0JAldfAciHDNFDRS/EEpgAAAAAAACJRICyVutUKY9E6qBjfjktoZBga2/RyCoiq+OPBI1ugik2fAAAAAAABAStQwwAAAAAAACJRIEOj7UvRXfRV9er0SUNeReHNqaiqtOoEhmW60JCFUoUyQhXAUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsCJtgX5iDHD5SbZ6yF5ZRRSk4qMD/f16u7MthJR1dRt6/15ASDcjS+e/wxPTb3gcKSOMw78kItip2ZWjZHmWPKEsyS4eK0gH5MjVzLmTKwzVprRw9vwQTgsO3dPz7BTO5sx1MKna/mtIAruBQmxbbccmZI4pIJ9uUVSaFmxPJVIerRnJTV8mp8lrCARPDoyqdMgtyGQoEoCCg2zl27zaXJnMljpo4o2Tz3DsLogF5Ic8VbMtOc9Qo+ZbtEbJFMT434nyXisTSzCHspGcuS6IDu5PfyLYYh9dx82MOmmPpfLr8/MeFVqR034OjGg74mcuiBAr69HxP+lbehkENjke6ortvBLYE9OokMjc33cP+CS37ogeacf/XHFA+8uL5G8z8j82nlG9GU87w2fPd4geV7zufC6INIfr3jGdRoNOOa9gCi5B/8H6ahppD/IN9az+N/2EZo2uiD1GZ764/KLuCR2Fjp+RYx61EXZv/sGgtENO9sstB+Ojrog+p2ILUX0BgvbgEIYOCjNh1RPHqmXOA5YbKt31f1phze6VpzAARcgUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsAAAAA='
  );

  const leafHash = computeLeafHash(psbt);
  const finalityProviderPk =
    '1f93235732e64cac33569ad1c3dbf041382c3b774fcfb0533b9b31d4c2a76bf9';
  // keys must be sorted https://github.com/babylonlabs-io/btc-staking-ts/blob/dev/src/staking/stakingScript.ts#L291
  const covenantPks = [
    '0aee0509b16db71c999238a4827db945526859b13c95487ab46725357c9a9f25',
    // Additional public keys omitted for brevity
  ];

  const params: SlashingParams = {
    leafHash,
    finalityProviderPk,
    covenantThreshold: 6,
    covenantPks,
  };

  const policy: WalletPolicy = await slashingPathPolicy({
    policyName: 'Consent to slashing',
    transport,
    params,
    derivationPath: DERIVATION_PATH,
    isTestnet: IS_TESTNET,
  });

  await signPsbt({ transport, psbt, policy });
}
```

This method is ideal if you want complete control over each parameter required for constructing the wallet policy for staking scripts.

#### Method 2: Automatically Parse the Policy from the Content of the Provided PSBT
This method simplifies the process by automatically extracting the required policy information directly from the PSBT content. It is a more streamlined approach—if the PSBT is successfully parsed, the wallet policy is generated automatically.

You can also construct the wallet policies for the unbonding script and the timelock script in this way.

```javascript
async function testSlashingScript2(transport: Transport) {
  const psbtBase64 =
    'cHNidP8BAH0CAAAAAZUPGfxRcPueN3/UdNQC64mF3lAumoEi9Gv6AgvbdVycAAAAAAD/////AsQJAAAAAAAAFgAUW+EmJNCKK0JAldfAciHDNFDRS/EEpgAAAAAAACJRICyVutUKY9E6qBjfjktoZBga2/RyCoiq+OPBI1ugik2fAAAAAAABAStQwwAAAAAAACJRIEOj7UvRXfRV9er0SUNeReHNqaiqtOoEhmW60JCFUoUyQhXAUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsCJtgX5iDHD5SbZ6yF5ZRRSk4qMD/f16u7MthJR1dRt6/15ASDcjS+e/wxPTb3gcKSOMw78kItip2ZWjZHmWPKEsyS4eK0gH5MjVzLmTKwzVprRw9vwQTgsO3dPz7BTO5sx1MKna/mtIAruBQmxbbccmZI4pIJ9uUVSaFmxPJVIerRnJTV8mp8lrCARPDoyqdMgtyGQoEoCCg2zl27zaXJnMljpo4o2Tz3DsLogF5Ic8VbMtOc9Qo+ZbtEbJFMT434nyXisTSzCHspGcuS6IDu5PfyLYYh9dx82MOmmPpfLr8/MeFVqR034OjGg74mcuiBAr69HxP+lbehkENjke6ortvBLYE9OokMjc33cP+CS37ogeacf/XHFA+8uL5G8z8j82nlG9GU87w2fPd4geV7zufC6INIfr3jGdRoNOOa9gCi5B/8H6ahppD/IN9az+N/2EZo2uiD1GZ764/KLuCR2Fjp+RYx61EXZv/sGgtENO9sstB+Ojrog+p2ILUX0BgvbgEIYOCjNh1RPHqmXOA5YbKt31f1phze6VpzAARcgUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsAAAAA=';

  const policy = await tryParsePsbt(transport, psbtBase64, IS_TESTNET);
  if (!policy) {
    throw new Error('PSBT parsing failed');
  }

  await signPsbt({ transport, psbt: psbtBase64, policy });
}
```

### Sign Message

The SDK supports two methods for message signing, allowing you to choose between the traditional ECDSA signature scheme or the BIP-322 simple signature format for Bitcoin.

#### ECDSA

```javascript
async function testSignECDSAMessage(transport: Transport) {
  const result: SignedMessage = await signMessage({
    transport,
    message: 'hello world',
    type: 'ecdsa',
    derivationPath: DERIVATION_PATH,
    isTestnet: IS_TESTNET,
  });

  console.log(result);
}
```

#### BIP-322

```javascript
async function testSignBIP322Message(transport: Transport) {
  const result: SignedMessage = await signMessage({
    transport,
    message: 'hello world',
    type: 'bip322-simple',
    derivationPath: DERIVATION_PATH,
    isTestnet: IS_TESTNET,
  });

  console.log(result);
}
```

### Sign Staking Transaction
Staking transactions in this context are standard Bitcoin transfer transactions that require extra context to be understood by the Ledger Babylon application. Since these PSBTs do not include parameters such as `finalityProviderPk`, `covenantPks`, or `timelockBlocks`, you must create a custom wallet policy using the `stakingTxPolicy` method.

```javascript
async function testStakingTx(transport: Transport) {
  const psbtBase64 =
    'cHNidP8BAIkCAAAAAZd78ohF47nbYYlbqpsG1C2SbwFnvX5vlD6YxdwhkQ50AQAAAAD/////AlDDAAAAAAAAIlEgvuEgqB2XZe+afeBe8ZLwNCRA7hqxujxpU15NDJOT+tElQCIAAAAAACJRIHQO5k5FLjuu4SewPBlbzCGtPt3tLvJsWvSD2cVjBNHlAAAAAAABASsuBCMAAAAAACJRIHQO5k5FLjuu4SewPBlbzCGtPt3tLvJsWvSD2cVjBNHlARcg3I0vnv8MT0294HCkjjMO/JCLYqdmVo2R5ljyhLMkuHgAAAA=';

  const finalityProviderPk = '1f93235732e64cac33569ad1c3dbf041382c3b774fcfb0533b9b31d4c2a76bf9';
  // keys must be sorted https://github.com/babylonlabs-io/btc-staking-ts/blob/dev/src/staking/stakingScript.ts#L291
  const covenantPks = [
    '0aee0509b16db71c999238a4827db945526859b13c95487ab46725357c9a9f25',
    '113c3a32a9d320b72190a04a020a0db3976ef36972673258e9a38a364f3dc3b0',
    '17921cf156ccb4e73d428f996ed11b245313e37e27c978ac4d2cc21eca4672e4',
    '3bb93dfc8b61887d771f3630e9a63e97cbafcfcc78556a474df83a31a0ef899c',
    '40afaf47c4ffa56de86410d8e47baa2bb6f04b604f4ea24323737ddc3fe092df',
    '79a71ffd71c503ef2e2f91bccfc8fcda7946f4653cef0d9f3dde20795ef3b9f0',
    'd21faf78c6751a0d38e6bd8028b907ff07e9a869a43fc837d6b3f8dff6119a36',
    'f5199efae3f28bb82476163a7e458c7ad445d9bffb0682d10d3bdb2cb41f8e8e',
    'fa9d882d45f4060bdb8042183828cd87544f1ea997380e586cab77d5fd698737',
  ];

  const params: StakingTxParams = {
    timelockBlocks: 64000,
    finalityProviderPk,
    covenantThreshold: 6,
    covenantPks,
  };

  const policy: WalletPolicy = await stakingTxPolicy({
    policyName: 'Staking transaction',
    transport,
    params,
    derivationPath: DERIVATION_PATH,
    isTestnet: IS_TESTNET,
  });

  await signPsbt({ transport, psbt: psbtBase64, policy });
}
```