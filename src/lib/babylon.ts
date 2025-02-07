import Transport from '@ledgerhq/hw-transport';
import { base64 } from '@scure/base';
import { Transaction } from '@scure/btc-signer';

import AppClient from './appClient';
import { WalletPolicy } from './policy';
import { getLeafHash, getTaprootScript } from './psbt';
import { createExtendedPubkey } from './xpub';

// export async function getLedgerTransport(): Promise<Transport> {
//   const TransportWebUSB = await import('@ledgerhq/hw-transport-webusb').then(
//     (m) => m.default
//   );
//   const transport = (await TransportWebUSB.create()) as Transport;
//
//   return transport;
// }

export async function signPsbt({
  transport,
  psbt,
  policy,
}: {
  transport: Transport;
  psbt: Uint8Array;
  policy: WalletPolicy;
}): Promise<Transaction> {
  const app = new AppClient(transport);

  const psbtBase64 = base64.encode(psbt);
  const signatures = await app.signPsbt(psbtBase64, policy, null);

  const hasScript = !!getTaprootScript(psbtBase64);

  const transaction = Transaction.fromPSBT(psbt);
  for (const signature of signatures) {
    const idx = signature[0];

    if (hasScript) {
      transaction.updateInput(
        idx,
        {
          tapScriptSig: [
            [
              {
                pubKey: signature[1].pubkey,
                leafHash: signature[1].tapleafHash!,
              },
              signature[1].signature,
            ],
          ],
        },
        true
      );
    } else {
      transaction.updateInput(
        idx,
        {
          tapKeySig: signature[1].signature,
        },
        true
      );
    }
  }

  return transaction;
}

export enum MessageSigningProtocols {
  ECDSA = 'ECDSA',
  BIP322 = 'BIP322',
}

export type SignedMessage = {
  signature: string;
  protocol: MessageSigningProtocols;
};

export async function signMessageECDSA({
  transport,
  message,
  derivationPath = `m/86'/0'/0'/0/0`,
}: {
  transport: Transport;
  message: string;
  derivationPath: string;
}): Promise<SignedMessage> {
  const app = new AppClient(transport);
  const signature = await app.signMessage(Buffer.from(message), derivationPath);
  return {
    signature,
    protocol: MessageSigningProtocols.ECDSA,
  };
}

export function computeLeafHash(psbt: Uint8Array): Buffer {
  const psbtBase64 = base64.encode(psbt);
  const script = getTaprootScript(psbtBase64)!;
  return getLeafHash(script);
}

function _formatKey(key: string | Buffer, isTestnet: boolean): string {
  return createExtendedPubkey(
    !isTestnet ? 'Mainnet' : 'Testnet',
    0,
    Buffer.from('00000000', 'hex'),
    0,
    Buffer.from(
      '0000000000000000000000000000000000000000000000000000000000000000',
      'hex'
    ),
    Buffer.concat([
      Buffer.from('02', 'hex'),
      key instanceof Buffer ? key : Buffer.from(key as string, 'hex'),
    ])
  );
}

async function _prepare(
  transport: Transport,
  derivationPath: string
): Promise<string[]> {
  const app = new AppClient(transport);
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(derivationPath);

  return [masterFingerPrint, extendedPublicKey];
}

export type SlashingPolicy = 'Stake / Step 1' | 'Stake / Step 2';
export type SlashingParams = {
  leafHash: Buffer;
  finalityProviderPk: string;
  covenantThreshold: number;
  covenantPks?: string[];
};

export async function slashingPathPolicy({
  policyName,
  transport,
  params,
  derivationPath,
  isTestnet = false,
}: {
  policyName: SlashingPolicy;
  transport: Transport;
  params: SlashingParams;
  derivationPath: string;
  isTestnet: boolean;
}): Promise<WalletPolicy> {
  const { leafHash, finalityProviderPk, covenantThreshold, covenantPks } =
    params;
  const [masterFingerPrint, extendedPublicKey] = await _prepare(
    transport,
    derivationPath
  );

  const keys: string[] = [];
  keys.push(_formatKey(leafHash, isTestnet));
  keys.push(
    `[${derivationPath.replace(
      'm/',
      `${masterFingerPrint}/`
    )}]${extendedPublicKey}`
  );
  keys.push(_formatKey(finalityProviderPk, isTestnet));

  if (covenantThreshold < 1) {
    throw new Error(
      `Invalid value for covenantThreshold: ${covenantThreshold}. It should be greater than or equal to 1.`
    );
  }

  const length = !covenantPks ? 0 : covenantPks!.length;
  if (length < 1) {
    throw new Error(
      `covenantPks must have at least 1 element. Current length: ${length}`
    );
  }

  if (length < covenantThreshold) {
    throw new Error(
      `The length of covenantPks (${length}) is less than the required covenantThreshold (${covenantThreshold}).`
    );
  }

  for (let index = 0; index < length; index++) {
    const pk = covenantPks![index];
    keys.push(_formatKey(pk, isTestnet));
  }

  return new WalletPolicy(
    policyName,
    // "tr(@0/**,and_v(pk_k(staker_pk), and_v(pk_k(finalityprovider_pk),multi_a(covenant_threshold, covenant_pk1, ..., covenant_pkn))))"
    `tr(@0/**,and_v(pk_k(@1/**),and_v(pk_k(@2),multi_a(${covenantThreshold}, ${Array.from(
      { length },
      (_, index) => index
    )
      .map((n) => `@${3 + n}`)
      .join(', ')}))))`,
    keys
  );
}

export type UnbondingPolicy = 'Unbond' | undefined;
export type UnbondingParams = {
  leafHash: Buffer;
  covenantThreshold: number;
  covenantPks?: string[];
};

export async function unbondingPathPolicy({
  policyName = 'Unbond',
  transport,
  params,
  derivationPath = `m/86'/0'/0'`,
  isTestnet = false,
}: {
  policyName: UnbondingPolicy;
  transport: Transport;
  params: UnbondingParams;
  derivationPath: string;
  isTestnet: boolean;
}): Promise<WalletPolicy> {
  const { leafHash, covenantThreshold, covenantPks } = params;
  const [masterFingerPrint, extendedPublicKey] = await _prepare(
    transport,
    derivationPath
  );

  const keys: string[] = [];
  keys.push(_formatKey(leafHash, isTestnet));
  keys.push(
    `[${derivationPath.replace(
      'm/',
      `${masterFingerPrint}/`
    )}]${extendedPublicKey}`
  );

  if (covenantThreshold < 1) {
    throw new Error(
      `Invalid value for covenantThreshold: ${covenantThreshold}. It should be greater than or equal to 1.`
    );
  }

  const length = !covenantPks ? 0 : covenantPks!.length;

  if (length < 1) {
    throw new Error(
      `covenantPks must have at least 1 element. Current length: ${length}`
    );
  }

  if (length < covenantThreshold) {
    throw new Error(
      `The length of covenantPks (${length}) is less than the required covenantThreshold (${covenantThreshold}).`
    );
  }

  for (let index = 0; index < length; index++) {
    const pk = covenantPks![index];
    keys.push(_formatKey(pk, isTestnet));
  }

  return new WalletPolicy(
    policyName,
    // "tr(@0/**,and_v(pk_k(staker_pk), multi_a(covenant_threshold, covenant_pk1, ..., covenant_pkn)))"
    `tr(@0/**,and_v(pk_k(@1/**),multi_a(${covenantThreshold}, ${Array.from(
      { length },
      (_, index) => index
    )
      .map((n) => `@${2 + n}`)
      .join(', ')})))`,
    keys
  );
}

export type TimelockPolicy = 'Withdraw' | undefined;
export type TimelockParams = {
  leafHash: Buffer;
  timelockBlocks: number;
};

export async function timelockPathPolicy({
  policyName = 'Withdraw',
  transport,
  params,
  derivationPath = `m/86'/0'/0'`,
  isTestnet = false,
}: {
  policyName: TimelockPolicy;
  transport: Transport;
  params: TimelockParams;
  derivationPath: string;
  isTestnet: boolean;
}): Promise<WalletPolicy> {
  const { leafHash, timelockBlocks } = params;
  const [masterFingerPrint, extendedPublicKey] = await _prepare(
    transport,
    derivationPath
  );

  const keys: string[] = [];
  keys.push(_formatKey(leafHash, isTestnet));
  keys.push(
    `[${derivationPath.replace(
      'm/',
      `${masterFingerPrint}/`
    )}]${extendedPublicKey}`
  );

  return new WalletPolicy(
    policyName,
    // tr(@0/**,and_v(pk_k(staker_pk), older(timelock_blocks)))
    `tr(@0/**,and_v(pk_k(@1/**), older(${timelockBlocks})))`,
    keys
  );
}

export async function stakingTxPolicy({
  transport,
  derivationPath = `m/86'/0'/0'`,
}: {
  transport: Transport;
  derivationPath: string;
}): Promise<WalletPolicy> {
  const [masterFingerPrint, extendedPublicKey] = await _prepare(
    transport,
    derivationPath
  );

  return new WalletPolicy('Stake / Transfer', 'tr(@0/**)', [
    `[${derivationPath.replace(
      'm/',
      `${masterFingerPrint}/`
    )}]${extendedPublicKey}`,
  ]);
}

/* Example */
// async function testStakingStep1() {
//   const psbt = base64.decode(
//     'cHNidP8BAH0CAAAAAZUPGfxRcPueN3/UdNQC64mF3lAumoEi9Gv6AgvbdVycAAAAAAD/////AsQJAAAAAAAAFgAUW+EmJNCKK0JAldfAciHDNFDRS/EEpgAAAAAAACJRICyVutUKY9E6qBjfjktoZBga2/RyCoiq+OPBI1ugik2fAAAAAAABAStQwwAAAAAAACJRIEOj7UvRXfRV9er0SUNeReHNqaiqtOoEhmW60JCFUoUyQhXAUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsCJtgX5iDHD5SbZ6yF5ZRRSk4qMD/f16u7MthJR1dRt6/15ASDcjS+e/wxPTb3gcKSOMw78kItip2ZWjZHmWPKEsyS4eK0gH5MjVzLmTKwzVprRw9vwQTgsO3dPz7BTO5sx1MKna/mtIAruBQmxbbccmZI4pIJ9uUVSaFmxPJVIerRnJTV8mp8lrCARPDoyqdMgtyGQoEoCCg2zl27zaXJnMljpo4o2Tz3DsLogF5Ic8VbMtOc9Qo+ZbtEbJFMT434nyXisTSzCHspGcuS6IDu5PfyLYYh9dx82MOmmPpfLr8/MeFVqR034OjGg74mcuiBAr69HxP+lbehkENjke6ortvBLYE9OokMjc33cP+CS37ogeacf/XHFA+8uL5G8z8j82nlG9GU87w2fPd4geV7zufC6INIfr3jGdRoNOOa9gCi5B/8H6ahppD/IN9az+N/2EZo2uiD1GZ764/KLuCR2Fjp+RYx61EXZv/sGgtENO9sstB+Ojrog+p2ILUX0BgvbgEIYOCjNh1RPHqmXOA5YbKt31f1phze6VpzAARcgUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsAAAAA=',
//   );

//   const transport = await getLedgerTransport();

//   const leafHash = computeLeafHash(psbt);
//   const finalityProviderPk = '1f93235732e64cac33569ad1c3dbf041382c3b774fcfb0533b9b31d4c2a76bf9';
//   const covenantPks = [
//     '0aee0509b16db71c999238a4827db945526859b13c95487ab46725357c9a9f25',
//     '113c3a32a9d320b72190a04a020a0db3976ef36972673258e9a38a364f3dc3b0',
//     '17921cf156ccb4e73d428f996ed11b245313e37e27c978ac4d2cc21eca4672e4',
//     '3bb93dfc8b61887d771f3630e9a63e97cbafcfcc78556a474df83a31a0ef899c',
//     '40afaf47c4ffa56de86410d8e47baa2bb6f04b604f4ea24323737ddc3fe092df',
//     '79a71ffd71c503ef2e2f91bccfc8fcda7946f4653cef0d9f3dde20795ef3b9f0',
//     'd21faf78c6751a0d38e6bd8028b907ff07e9a869a43fc837d6b3f8dff6119a36',
//     'f5199efae3f28bb82476163a7e458c7ad445d9bffb0682d10d3bdb2cb41f8e8e',
//     'fa9d882d45f4060bdb8042183828cd87544f1ea997380e586cab77d5fd698737',
//   ];

//   const params = {
//     leafHash,
//     finalityProviderPk,
//     covenantThreshold: 6,
//     covenantPks,
//   };

//   const policy = await slashingPathPolicy({
//     policyName: 'Stake / Step 1',
//     transport,
//     params,
//     derivationPath: `m/86'/1'/0'`,
//     isTestnet: true,
//   });

//   await signPsbt({ transport, psbt, policy });
// }
