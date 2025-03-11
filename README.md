# Ledger Babylon application client

## Overview

TypeScript client for Ledger Babylon application.

## Install

```bash
$ yarn add ledger-bitcoin-babylon
```

Or if you prefer using npm:

```bash
$ npm install ledger-bitcoin-babylon
```

## Building

```bash
$ yarn

$ yarn build
```

## Getting started

```javascript
import { AppClient, WalletPolicy } from 'ledger-bitcoin-babylon';
import Transport from '@ledgerhq/hw-transport-node-hid';

// Method 1: Explicitly pass all required parameters to construct the policy.
async function testStakingStep1(transport: Transport) {
  const psbt = base64.decode(
    'cHNidP8BAH0CAAAAAZUPGfxRcPueN3/UdNQC64mF3lAumoEi9Gv6AgvbdVycAAAAAAD/////AsQJAAAAAAAAFgAUW+EmJNCKK0JAldfAciHDNFDRS/EEpgAAAAAAACJRICyVutUKY9E6qBjfjktoZBga2/RyCoiq+OPBI1ugik2fAAAAAAABAStQwwAAAAAAACJRIEOj7UvRXfRV9er0SUNeReHNqaiqtOoEhmW60JCFUoUyQhXAUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsCJtgX5iDHD5SbZ6yF5ZRRSk4qMD/f16u7MthJR1dRt6/15ASDcjS+e/wxPTb3gcKSOMw78kItip2ZWjZHmWPKEsyS4eK0gH5MjVzLmTKwzVprRw9vwQTgsO3dPz7BTO5sx1MKna/mtIAruBQmxbbccmZI4pIJ9uUVSaFmxPJVIerRnJTV8mp8lrCARPDoyqdMgtyGQoEoCCg2zl27zaXJnMljpo4o2Tz3DsLogF5Ic8VbMtOc9Qo+ZbtEbJFMT434nyXisTSzCHspGcuS6IDu5PfyLYYh9dx82MOmmPpfLr8/MeFVqR034OjGg74mcuiBAr69HxP+lbehkENjke6ortvBLYE9OokMjc33cP+CS37ogeacf/XHFA+8uL5G8z8j82nlG9GU87w2fPd4geV7zufC6INIfr3jGdRoNOOa9gCi5B/8H6ahppD/IN9az+N/2EZo2uiD1GZ764/KLuCR2Fjp+RYx61EXZv/sGgtENO9sstB+Ojrog+p2ILUX0BgvbgEIYOCjNh1RPHqmXOA5YbKt31f1phze6VpzAARcgUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsAAAAA='
  );

  const leafHash = computeLeafHash(psbt);
  const finalityProviderPk =
    '1f93235732e64cac33569ad1c3dbf041382c3b774fcfb0533b9b31d4c2a76bf9';
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

  const params = {
    leafHash,
    finalityProviderPk,
    covenantThreshold: 6,
    covenantPks,
  };

  const policy = await slashingPathPolicy({
    policyName: 'Slashing consent',
    transport,
    params,
    derivationPath: `m/86'/1'/0'`,
    isTestnet: true,
  });

  await signPsbt({ transport, psbt, policy });
}

// Method 2: Automatically parse the policy from the content of the provided PSBT.
async function testStakingStep2(transport: Transport) {
  const psbtBase64 =
    'cHNidP8BAH0CAAAAAZUPGfxRcPueN3/UdNQC64mF3lAumoEi9Gv6AgvbdVycAAAAAAD/////AsQJAAAAAAAAFgAUW+EmJNCKK0JAldfAciHDNFDRS/EEpgAAAAAAACJRICyVutUKY9E6qBjfjktoZBga2/RyCoiq+OPBI1ugik2fAAAAAAABAStQwwAAAAAAACJRIEOj7UvRXfRV9er0SUNeReHNqaiqtOoEhmW60JCFUoUyQhXAUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsCJtgX5iDHD5SbZ6yF5ZRRSk4qMD/f16u7MthJR1dRt6/15ASDcjS+e/wxPTb3gcKSOMw78kItip2ZWjZHmWPKEsyS4eK0gH5MjVzLmTKwzVprRw9vwQTgsO3dPz7BTO5sx1MKna/mtIAruBQmxbbccmZI4pIJ9uUVSaFmxPJVIerRnJTV8mp8lrCARPDoyqdMgtyGQoEoCCg2zl27zaXJnMljpo4o2Tz3DsLogF5Ic8VbMtOc9Qo+ZbtEbJFMT434nyXisTSzCHspGcuS6IDu5PfyLYYh9dx82MOmmPpfLr8/MeFVqR034OjGg74mcuiBAr69HxP+lbehkENjke6ortvBLYE9OokMjc33cP+CS37ogeacf/XHFA+8uL5G8z8j82nlG9GU87w2fPd4geV7zufC6INIfr3jGdRoNOOa9gCi5B/8H6ahppD/IN9az+N/2EZo2uiD1GZ764/KLuCR2Fjp+RYx61EXZv/sGgtENO9sstB+Ojrog+p2ILUX0BgvbgEIYOCjNh1RPHqmXOA5YbKt31f1phze6VpzAARcgUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsAAAAA=';

  const policy = await tryParsePsbt(transport, psbtBase64, true);

  await signPsbt({ transport, psbt: psbtBase64, policy: policy! });
}

async function testStakingTx(transport: Transport) {
  const psbtBase64 = 'cHNidP8BAIkCAAAAAZd78ohF47nbYYlbqpsG1C2SbwFnvX5vlD6YxdwhkQ50AQAAAAD/////AlDDAAAAAAAAIlEgvuEgqB2XZe+afeBe8ZLwNCRA7hqxujxpU15NDJOT+tElQCIAAAAAACJRIHQO5k5FLjuu4SewPBlbzCGtPt3tLvJsWvSD2cVjBNHlAAAAAAABASsuBCMAAAAAACJRIHQO5k5FLjuu4SewPBlbzCGtPt3tLvJsWvSD2cVjBNHlARcg3I0vnv8MT0294HCkjjMO/JCLYqdmVo2R5ljyhLMkuHgAAAA=';

  const finalityProviderPk =
    '1f93235732e64cac33569ad1c3dbf041382c3b774fcfb0533b9b31d4c2a76bf9';
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

  const params = {
    timelockBlocks: 64000,
    finalityProviderPk,
    covenantThreshold: 6,
    covenantPks,
  };

  const policy = await stakingTxPolicy({
    policyName: 'Staking transaction',
    transport,
    params,
    derivationPath: `m/86'/1'/0'`,
    isTestnet: true,
  });

  await signPsbt({ transport, psbt: psbtBase64, policy: policy!  });
}

async function main(transport) {
    const app = new AppClient(transport);

    const fpr = await app.getMasterFingerprint();
    console.log("Master key fingerprint:", fpr.toString("hex"));

    // ==> Get and display on screen the first taproot address
    const firstTaprootAccountPubkey = await app.getExtendedPubkey("m/86'/1'/0'");
    const firstTaprootAccountPolicy = new DefaultWalletPolicy(
        "tr(@0/**)",
        `[${fpr}/86'/1'/0']${firstTaprootAccountPubkey}`
    );

    const firstTaprootAccountAddress = await app.getWalletAddress(
        firstTaprootAccountPolicy,
        null,
        0,
        0,
        true // show address on the wallet's screen
    );

    console.log("First taproot account receive address:", firstTaprootAccountAddress);

    await testStakingStep1(transport);
    await testStakingStep2(transport);
    await testStakingTx(transport);

    await transport.close();
}

Transport.default.create()
    .then(main)
    .catch(console.log);
```
