import * as crypto from 'crypto';

import bs58 from 'bs58';

// Double SHA256 hash function
function hash256(data: Buffer): Buffer {
  return crypto
    .createHash('sha256')
    .update(crypto.createHash('sha256').update(data).digest())
    .digest();
}

export function createExtendedPubkey(
  network: 'Mainnet' | 'Testnet',
  depth = 0,
  parentFingerprint = Buffer.from('00000000', 'hex'),
  childIndex = 0,
  chainCode = Buffer.from(
    '0000000000000000000000000000000000000000000000000000000000000000',
    'hex'
  ),
  pubkey: Buffer
): string {
  let version: Buffer;

  // Define version based on network
  if (network === 'Mainnet') {
    version = Buffer.from('0488b21e', 'hex'); // xpub
  } else if (network === 'Testnet') {
    version = Buffer.from('043587cf', 'hex'); // tpub
  } else {
    throw new Error("Invalid network. Use 'Mainnet' or 'Testnet'.");
  }

  // Serialize extended public key components
  const serialized = Buffer.concat([
    version, // 4 bytes: version
    Buffer.from([depth]), // 1 byte: depth
    parentFingerprint, // 4 bytes: parent fingerprint
    Buffer.from([
      childIndex >> 24,
      (childIndex >> 16) & 0xff,
      (childIndex >> 8) & 0xff,
      childIndex & 0xff,
    ]), // 4 bytes: child index
    chainCode, // 32 bytes: chain code
    pubkey, // 33 bytes: compressed public key
  ]);

  // Calculate checksum (double SHA256, first 4 bytes)
  const checksum = hash256(serialized).slice(0, 4);

  // Append checksum and encode in Base58 using bs58
  const extendedPubkey = bs58.encode(Buffer.concat([serialized, checksum]));
  return extendedPubkey;
}

// // Example usage
// const network = 'testnet';  // Change to 'mainnet' for xpub
// const depth = 0;  // Root level
// const parentFingerprint = Buffer.from('00000000', 'hex');  // No parent (root key)
// const childIndex = 0;  // Root index
// const chainCode = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');  // Example chain code
// const pubkey = Buffer.from('0250929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0', 'hex');  // Compressed public key

// // Generate xpub or tpub based on the network
// const extendedPubkeyTestnet = createExtendedPubkey(network, depth, parentFingerprint, childIndex, chainCode, pubkey);
// console.log(`Generated extended public key (testnet): ${extendedPubkeyTestnet}`);

// const networkMainnet = 'mainnet';
// const extendedPubkeyMainnet = createExtendedPubkey(networkMainnet, depth, parentFingerprint, childIndex, chainCode, pubkey);
// console.log(`Generated extended public key (mainnet): ${extendedPubkeyMainnet}`);
