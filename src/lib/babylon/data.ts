
/*
TAG=1 LEN=2 Value
Action Type:  2=Staking 3=Unbond 0=SLASHING 1=UNBONDING SLASHING 4=withdraw 5=sign message 6=expansion 0x10 get version
5=WITHDRAW 6=SIGN MESSAGE
Action Type:                  TAG 0x77  LEN 00 01      VALUE action type
Finality provider count:      TAG 0xf9  LEN 00 0n      VALUE count
Finality provider list:       TAG 0xf8  LEN 32*n       VALUE n pubkey
Cov key count:                TAG 0xc0  LEN 00 0n      VALUE count
Cov key list:                 TAG 0xc1  LEN 32*n       VALUE n pubkey
staker pk:                    TAG 0x51  LEN 32         VALUE pubkey
cov quorum:                   TAG 0x01  LEN 00 01      VALUE quorum
timelock:                     TAG 0x71  LEN 00 08      VALUE timelock uint64
slashing fee limit:           TAG 0xfe  LEN 00 08      VALUE limit uint64
unbonding fee limit:          TAG 0xff  LEN 00 08      VALUE limit uint64
message                       TAG 0x33  LEN 00 XX      VALUE message BUFFER
message_pubkey:               TAG 0x34  LEN 32         VALUE pubkey BUFFER
txid:                         TAG 0x35  LEN 00 20      VALUE txid BUFFER
burning address:              TAG 0x36  LEN 00 XX      VALUE address BUFFER
bip32fullpath:                TAG 0x37  LEN 00 XX      VALUE bip32fullpath BUFFER
*/

function parseBip32Path(path: string): number[] {
  // 例如 m/86'/1'/0'/0/0
  const parts = path.split('/');
  if (parts[0] !== 'm' || parts.length !== 6) throw new Error('Invalid BIP32 path');
  return parts.slice(1).map(p => {
    if (p.endsWith("'")) {
      return (parseInt(p.replace("'", ""), 10) | 0x80000000) >>> 0;
    }
    return parseInt(p, 10) >>> 0;
  });
}

/**
 * Encodes staking transaction policy parameters into a TLV (Tag-Length-Value) formatted Buffer.
 *
 * @param timelockBlocks - The number of blocks for the staking timelock (uint64).
 * @param finalityProviders - An array of finality provider public keys (hex strings, each 32 bytes).
 * @param covenantThreshold - The threshold value for the covenant (quorum).
 * @param covenantPks - An array of covenant public keys (hex strings, each 32 bytes).
 * @returns The encoded TLV Buffer representing the staking transaction policy.
 * @throws {Error} If any public key is not 32 bytes in length.
 */

export function encodeStakingTxPolicyToTLV(
  bip32Path: string,
  timelockBlocks: number,
  finalityProviders: string[],
  covenantThreshold: number,
  covenantPks: string[]
): Buffer {
  const buffers: Buffer[] = [];

  // Action Type: TAG 0x77 LEN 00 01 VALUE action type (1=Staking)
  buffers.push(Buffer.from([0x77])); // TAG
  buffers.push(Buffer.from([0x00, 0x01])); // LEN (2 bytes)
  buffers.push(Buffer.from([0x02])); // VALUE (1 = Staking)

  const pathArray = parseBip32Path(bip32Path);
  const pathBuffer = Buffer.alloc(4 * pathArray.length);
  pathArray.forEach((v, i) => pathBuffer.writeUInt32BE(v, i * 4));
  buffers.push(Buffer.from([0x37])); // TAG
  buffers.push(Buffer.from([0x00, pathBuffer.length])); // LEN (2 bytes)
  buffers.push(pathBuffer); // VALUE

  // Finality provider count: TAG 0xf9 LEN 00 0n VALUE count
  const fpCount = finalityProviders.length;
  buffers.push(Buffer.from([0xf9])); // TAG
  buffers.push(Buffer.from([0x00, fpCount])); // LEN (2 bytes)
  buffers.push(Buffer.from([fpCount])); // VALUE

  // Finality provider list: TAG 0xf8 LEN 32*n VALUE n pubkey
  if (fpCount > 0) {
    buffers.push(Buffer.from([0xf8])); // TAG
    const fpListLen = 32 * fpCount;
    buffers.push(Buffer.from([Math.floor(fpListLen / 256), fpListLen % 256])); // LEN (2 bytes)
    
    // VALUE: n pubkeys (each 32 bytes)
    for (const fp of finalityProviders) {
      const fpBuffer = Buffer.from(fp, 'hex');
      if (fpBuffer.length !== 32) {
        throw new Error(`Invalid finality provider pubkey length: ${fpBuffer.length}, expected 32`);
      }
      buffers.push(fpBuffer);
    }
  }

  // Cov key count: TAG 0xc0 LEN 00 0n VALUE count
  const covCount = covenantPks.length;
  buffers.push(Buffer.from([0xc0])); // TAG
  buffers.push(Buffer.from([0x00, 1])); // LEN (2 bytes)
  buffers.push(Buffer.from([covCount])); // VALUE

  // Cov key list: TAG 0xc1 LEN 32*n VALUE n pubkey
  if (covCount > 0) {
    buffers.push(Buffer.from([0xc1])); // TAG
    const covListLen = 32 * covCount;
    buffers.push(Buffer.from([Math.floor(covListLen / 256), covListLen % 256])); // LEN (2 bytes)
    
    // VALUE: n pubkeys (each 32 bytes)
    for (const covPk of covenantPks) {
      const covBuffer = Buffer.from(covPk, 'hex');
      if (covBuffer.length !== 32) {
        throw new Error(`Invalid covenant pubkey length: ${covBuffer.length}, expected 32`);
      }
      buffers.push(covBuffer);
    }
  }

  // Cov quorum: TAG 0x01 LEN 00 01 VALUE quorum
  buffers.push(Buffer.from([0x01])); // TAG
  buffers.push(Buffer.from([0x00, 0x01])); // LEN (2 bytes)
  buffers.push(Buffer.from([covenantThreshold])); // VALUE

  // Stake timelock: TAG 0x71 LEN 00 08 VALUE timelock uint64
  buffers.push(Buffer.from([0x71])); // TAG
  buffers.push(Buffer.from([0x00, 0x08])); // LEN (2 bytes)
  // VALUE: uint64 big-endian
  const timelockBuffer = Buffer.alloc(8);
  timelockBuffer.writeUInt32BE(Math.floor(timelockBlocks / 0x100000000), 0); // 高32位
  timelockBuffer.writeUInt32BE(timelockBlocks % 0x100000000, 4); // 低32位
  buffers.push(timelockBuffer);

  return Buffer.concat(buffers as Uint8Array[]);
}


/**
 * Encodes slashing transaction policy parameters into a TLV (Tag-Length-Value) formatted Buffer.
 *
 * @param finalityProviders - An array of finality provider public keys (hex strings, each 32 bytes).
 * @param covenantThreshold - The threshold value for the covenant (quorum).
 * @param covenantPks - An array of covenant public keys (hex strings, each 32 bytes).
 * @param fee - The slashing fee limit (uint64).
 * @returns The encoded TLV Buffer representing the slashing transaction policy.
 * @throws {Error} If any public key is not 32 bytes in length.
 */
export function encodeSlashingTxPolicyToTLV(
  bip32Path: string,
  timelockBlocks: number,
  finalityProviders: string[],
  covenantThreshold: number,
  covenantPks: string[],
  slashingPkScriptHex: string,
  fee: number
): Buffer {
  if (!covenantPks) {
    throw new Error('covenantPks is required');
 }
  const buffers: Buffer[] = [];

  // Action Type: TAG 0x77 LEN 00 01 VALUE action type (0=SLASHING)
  buffers.push(Buffer.from([0x77])); // TAG
  buffers.push(Buffer.from([0x00, 0x01])); // LEN (2 bytes)
  buffers.push(Buffer.from([0x00])); // VALUE (0 = SLASHING)

  const pathArray = parseBip32Path(bip32Path);
  const pathBuffer = Buffer.alloc(4 * pathArray.length);
  pathArray.forEach((v, i) => pathBuffer.writeUInt32BE(v, i * 4));
  buffers.push(Buffer.from([0x37])); // TAG
  buffers.push(Buffer.from([0x00, pathBuffer.length])); // LEN (2 bytes)
  buffers.push(pathBuffer); // VALUE
  // Finality provider count: TAG 0xf9 LEN 00 0n VALUE count
  const fpCount = finalityProviders.length;
  buffers.push(Buffer.from([0xf9])); // TAG
  buffers.push(Buffer.from([0x00, fpCount])); // LEN (2 bytes)
  buffers.push(Buffer.from([fpCount])); // VALUE

  // Finality provider list: TAG 0xf8 LEN 32*n VALUE n pubkey
  if (fpCount > 0) {
    buffers.push(Buffer.from([0xf8])); // TAG
    const fpListLen = 32 * fpCount;
    buffers.push(Buffer.from([Math.floor(fpListLen / 256), fpListLen % 256])); // LEN (2 bytes)
    
    // VALUE: n pubkeys (each 32 bytes)
    for (const fp of finalityProviders) {
      const fpBuffer = Buffer.from(fp, 'hex');
      if (fpBuffer.length !== 32) {
        throw new Error(`Invalid finality provider pubkey length: ${fpBuffer.length}, expected 32`);
      }
      buffers.push(fpBuffer);
    }
  }

  // Cov key count: TAG 0xc0 LEN 00 0n VALUE count
  const covCount = covenantPks.length;
  buffers.push(Buffer.from([0xc0])); // TAG
  buffers.push(Buffer.from([0x00, 1])); // LEN (2 bytes)
  buffers.push(Buffer.from([covCount])); // VALUE

  // Cov key list: TAG 0xc1 LEN 32*n VALUE n pubkey
  if (covCount > 0) {
    buffers.push(Buffer.from([0xc1])); // TAG
    const covListLen = 32 * covCount;
    buffers.push(Buffer.from([Math.floor(covListLen / 256), covListLen % 256])); // LEN (2 bytes)
    
    // VALUE: n pubkeys (each 32 bytes)
    for (const covPk of covenantPks) {
      const covBuffer = Buffer.from(covPk, 'hex');
      if (covBuffer.length !== 32) {
        throw new Error(`Invalid covenant pubkey length: ${covBuffer.length}, expected 32`);
      }
      buffers.push(covBuffer);
    }
  }

  // Cov quorum: TAG 0x01 LEN 00 01 VALUE quorum
  buffers.push(Buffer.from([0x01])); // TAG
  buffers.push(Buffer.from([0x00, 0x01])); // LEN (2 bytes)
  buffers.push(Buffer.from([covenantThreshold])); // VALUE

  // Slashing fee limit: TAG 0xfe LEN 00 08 VALUE limit uint64
  buffers.push(Buffer.from([0xfe])); // TAG
  buffers.push(Buffer.from([0x00, 0x08])); // LEN (2 bytes)
  // VALUE: uint64 big-endian
  const feeBuffer = Buffer.alloc(8);
  feeBuffer.writeUInt32BE(Math.floor(fee / 0x100000000), 0); // 高32位
  feeBuffer.writeUInt32BE(fee % 0x100000000, 4); // 低32位
  buffers.push(feeBuffer);

     // Burning address: TAG 0x36 LEN 00 XX VALUE address BUFFER
  const slashingPkScriptBuffer = Buffer.from(slashingPkScriptHex, 'hex');
  buffers.push(Buffer.from([0x36])); // TAG
  buffers.push(Buffer.from([0x00, slashingPkScriptBuffer.length])); // LEN (2 bytes)
  buffers.push(slashingPkScriptBuffer); // VALUE

  buffers.push(Buffer.from([0x71])); // TAG
  buffers.push(Buffer.from([0x00, 0x08])); // LEN (2 bytes)

  const timelockBuffer = Buffer.alloc(8);
  timelockBuffer.writeUInt32BE(Math.floor(timelockBlocks / 0x100000000), 0); // 高32位
  timelockBuffer.writeUInt32BE(timelockBlocks % 0x100000000, 4); // 低32位
  buffers.push(timelockBuffer);

  return Buffer.concat(buffers as Uint8Array[]);
}
/**
 * Encodes slashing transaction policy parameters into a TLV (Tag-Length-Value) formatted Buffer.
 *
 * @param finalityProviders - An array of finality provider public keys (hex strings, each 32 bytes).
 * @param covenantThreshold - The threshold value for the covenant (quorum).
 * @param covenantPks - An array of covenant public keys (hex strings, each 32 bytes).
 * @param fee - The slashing fee limit (uint64).
 * @returns The encoded TLV Buffer representing the slashing transaction policy.
 * @throws {Error} If any public key is not 32 bytes in length.
 */
export function encodeUnbondPolicyToTLV(
  bip32Path: string,
  timelockBlocks: number,
  finalityProviders: string[],
  covenantThreshold: number,
  covenantPks: string[],
  fee: number
): Buffer {
  if (!covenantPks) {
    throw new Error('covenantPks is required');
  }
  const buffers: Buffer[] = [];

  // Action Type: TAG 0x77 LEN 00 01 VALUE action type (0=SLASHING)
  buffers.push(Buffer.from([0x77])); // TAG
  buffers.push(Buffer.from([0x00, 0x01])); // LEN (2 bytes)
  buffers.push(Buffer.from([0x03])); // VALUE (0 = SLASHING)

  const pathArray = parseBip32Path(bip32Path);
  const pathBuffer = Buffer.alloc(4 * pathArray.length);
  pathArray.forEach((v, i) => pathBuffer.writeUInt32BE(v, i * 4));
  buffers.push(Buffer.from([0x37])); // TAG
  buffers.push(Buffer.from([0x00, pathBuffer.length])); // LEN (2 bytes)
  buffers.push(pathBuffer); // VALUE

  // Finality provider count: TAG 0xf9 LEN 00 0n VALUE count
  const fpCount = finalityProviders.length;
  buffers.push(Buffer.from([0xf9])); // TAG
  buffers.push(Buffer.from([0x00, fpCount])); // LEN (2 bytes)
  buffers.push(Buffer.from([fpCount])); // VALUE

  // Finality provider list: TAG 0xf8 LEN 32*n VALUE n pubkey
  if (fpCount > 0) {
    buffers.push(Buffer.from([0xf8])); // TAG
    const fpListLen = 32 * fpCount;
    buffers.push(Buffer.from([Math.floor(fpListLen / 256), fpListLen % 256])); // LEN (2 bytes)
    
    // VALUE: n pubkeys (each 32 bytes)
    for (const fp of finalityProviders) {
      const fpBuffer = Buffer.from(fp, 'hex');
      if (fpBuffer.length !== 32) {
        throw new Error(`Invalid finality provider pubkey length: ${fpBuffer.length}, expected 32`);
      }
      buffers.push(fpBuffer);
    }
  }

  // Cov key count: TAG 0xc0 LEN 00 0n VALUE count
  const covCount = covenantPks.length;
  buffers.push(Buffer.from([0xc0])); // TAG
  buffers.push(Buffer.from([0x00, 1])); // LEN (2 bytes)
  buffers.push(Buffer.from([covCount])); // VALUE

  // Cov key list: TAG 0xc1 LEN 32*n VALUE n pubkey
  if (covCount > 0) {
    buffers.push(Buffer.from([0xc1])); // TAG
    const covListLen = 32 * covCount;
    buffers.push(Buffer.from([Math.floor(covListLen / 256), covListLen % 256])); // LEN (2 bytes)
    
    // VALUE: n pubkeys (each 32 bytes)
    for (const covPk of covenantPks) {
      const covBuffer = Buffer.from(covPk, 'hex');
      if (covBuffer.length !== 32) {
        throw new Error(`Invalid covenant pubkey length: ${covBuffer.length}, expected 32`);
      }
      buffers.push(covBuffer);
    }
  }

  // Cov quorum: TAG 0x01 LEN 00 01 VALUE quorum
  buffers.push(Buffer.from([0x01])); // TAG
  buffers.push(Buffer.from([0x00, 0x01])); // LEN (2 bytes)
  buffers.push(Buffer.from([covenantThreshold])); // VALUE

  // Unbonding fee limit: TAG 0xfe LEN 00 08 VALUE limit uint64
  buffers.push(Buffer.from([0xff])); // TAG
  buffers.push(Buffer.from([0x00, 0x08])); // LEN (2 bytes)
  // VALUE: uint64 big-endian
  const feeBuffer = Buffer.alloc(8);
  feeBuffer.writeUInt32BE(Math.floor(fee / 0x100000000), 0); // 高32位
  feeBuffer.writeUInt32BE(fee % 0x100000000, 4); // 低32位
  buffers.push(feeBuffer);

  buffers.push(Buffer.from([0x71])); // TAG
  buffers.push(Buffer.from([0x00, 0x08])); // LEN (2 bytes)

  const timelockBuffer = Buffer.alloc(8);
  timelockBuffer.writeUInt32BE(Math.floor(timelockBlocks / 0x100000000), 0); // 高32位
  timelockBuffer.writeUInt32BE(timelockBlocks % 0x100000000, 4); // 低32位
  buffers.push(timelockBuffer);

  return Buffer.concat(buffers as Uint8Array[]);
}


/**
 * Encodes slashing transaction policy parameters into a TLV (Tag-Length-Value) formatted Buffer.
 *
 * @param finalityProviders - An array of finality provider public keys (hex strings, each 32 bytes).
 * @param covenantThreshold - The threshold value for the covenant (quorum).
 * @param covenantPks - An array of covenant public keys (hex strings, each 32 bytes).
 * @param fee - The slashing fee limit (uint64).
 * @returns The encoded TLV Buffer representing the slashing transaction policy.
 * @throws {Error} If any public key is not 32 bytes in length.
 */
export function encodeWithdrawPolicyToTLV(
  bip32Path: string,
  timelockBlocks: number,
): Buffer {
  const buffers: Buffer[] = [];

  // Action Type: TAG 0x77 LEN 00 01 VALUE action type (0=SLASHING)
  buffers.push(Buffer.from([0x77])); // TAG
  buffers.push(Buffer.from([0x00, 0x01])); // LEN (2 bytes)
  buffers.push(Buffer.from([0x04])); // VALUE (0 = SLASHING)

  const pathArray = parseBip32Path(bip32Path);
  const pathBuffer = Buffer.alloc(4 * pathArray.length);
  pathArray.forEach((v, i) => pathBuffer.writeUInt32BE(v, i * 4));
  buffers.push(Buffer.from([0x37])); // TAG
  buffers.push(Buffer.from([0x00, pathBuffer.length])); // LEN (2 bytes)
  buffers.push(pathBuffer); // VALUE

  buffers.push(Buffer.from([0x71])); // TAG
  buffers.push(Buffer.from([0x00, 0x08])); // LEN (2 bytes)

  const timelockBuffer = Buffer.alloc(8);
  timelockBuffer.writeUInt32BE(Math.floor(timelockBlocks / 0x100000000), 0); // 高32位
  timelockBuffer.writeUInt32BE(timelockBlocks % 0x100000000, 4); // 低32位
  buffers.push(timelockBuffer);

  return Buffer.concat(buffers as Uint8Array[]);
}

export function encodeSignMessagePolicyToTLV(
  bip32Path: string,
  message: Buffer,
  pubkey: Buffer,
): Buffer {
  const buffers: Buffer[] = [];

  // Action Type: TAG 0x77 LEN 00 01 VALUE action type (0=SLASHING)
  buffers.push(Buffer.from([0x77])); // TAG
  buffers.push(Buffer.from([0x00, 0x01])); // LEN (2 bytes)
  buffers.push(Buffer.from([0x05])); // VALUE (0 = SLASHING)

  const pathArray = parseBip32Path(bip32Path);
  const pathBuffer = Buffer.alloc(4 * pathArray.length);
  pathArray.forEach((v, i) => pathBuffer.writeUInt32BE(v, i * 4));
  buffers.push(Buffer.from([0x37])); // TAG
  buffers.push(Buffer.from([0x00, pathBuffer.length])); // LEN (2 bytes)
  buffers.push(pathBuffer); // VALUE
  // Message: TAG 0x33 LEN 00 XX VALUE message BUFFER
  //const messageBuffer = Buffer.from(message, 'hex');
  console.log("Message Buffer:", message);
  console.log("Message Length:", message.length);
  buffers.push(Buffer.from([0x33])); // TAG
  buffers.push(Buffer.from([0x00, message.length])); // LEN (2 bytes)
  buffers.push(message); // VALUE

  // Message pubkey: TAG 0x34 LEN 32 VALUE pubkey BUFFER
  if (pubkey.length == 32) {
    //console.log("pubkey:", pubkey);
    //throw new Error(`Invalid pubkey length: ${pubkey.length}, expected 32`);
    
    buffers.push(Buffer.from([0x34])); // TAG
    buffers.push(Buffer.from([0x00, 0x20])); // LEN (32 bytes)
    buffers.push(pubkey); // VALUE
  }
  return Buffer.concat(buffers as Uint8Array[]);
}


/**
 * Encodes Expansion transaction policy parameters into a TLV (Tag-Length-Value) formatted Buffer.
 *
 * @param timelockBlocks - The number of blocks for the staking timelock (uint64).
 * @param finalityProviders - An array of finality provider public keys (hex strings, each 32 bytes).
 * @param covenantThreshold - The threshold value for the covenant (quorum).
 * @param covenantPks - An array of covenant public keys (hex strings, each 32 bytes).
 * @returns The encoded TLV Buffer representing the staking transaction policy.
 * @throws {Error} If any public key is not 32 bytes in length.
 */

export function encodeExpansionPolicyToTLV(
  bip32Path: string,
  timelockBlocks: number,
  finalityProviders: string[],
  covenantThreshold: number,
  covenantPks: string[]
): Buffer {
  const buffers: Buffer[] = [];

  // Action Type: TAG 0x77 LEN 00 01 VALUE action type (1=Staking)
  buffers.push(Buffer.from([0x77])); // TAG
  buffers.push(Buffer.from([0x00, 0x01])); // LEN (2 bytes)
  buffers.push(Buffer.from([0x06])); // VALUE (1 = Staking)

  const pathArray = parseBip32Path(bip32Path);
  const pathBuffer = Buffer.alloc(4 * pathArray.length);
  pathArray.forEach((v, i) => pathBuffer.writeUInt32BE(v, i * 4));
  buffers.push(Buffer.from([0x37])); // TAG
  buffers.push(Buffer.from([0x00, pathBuffer.length])); // LEN (2 bytes)
  buffers.push(pathBuffer); // VALUE

  // Finality provider count: TAG 0xf9 LEN 00 0n VALUE count
  const fpCount = finalityProviders.length;
  buffers.push(Buffer.from([0xf9])); // TAG
  buffers.push(Buffer.from([0x00, fpCount])); // LEN (2 bytes)
  buffers.push(Buffer.from([fpCount])); // VALUE

  // Finality provider list: TAG 0xf8 LEN 32*n VALUE n pubkey
  if (fpCount > 0) {
    buffers.push(Buffer.from([0xf8])); // TAG
    const fpListLen = 32 * fpCount;
    buffers.push(Buffer.from([Math.floor(fpListLen / 256), fpListLen % 256])); // LEN (2 bytes)
    
    // VALUE: n pubkeys (each 32 bytes)
    for (const fp of finalityProviders) {
      const fpBuffer = Buffer.from(fp, 'hex');
      if (fpBuffer.length !== 32) {
        throw new Error(`Invalid finality provider pubkey length: ${fpBuffer.length}, expected 32`);
      }
      buffers.push(fpBuffer);
    }
  }

  // Cov key count: TAG 0xc0 LEN 00 0n VALUE count
  const covCount = covenantPks.length;
  buffers.push(Buffer.from([0xc0])); // TAG
  buffers.push(Buffer.from([0x00, 1])); // LEN (2 bytes)
  buffers.push(Buffer.from([covCount])); // VALUE

  // Cov key list: TAG 0xc1 LEN 32*n VALUE n pubkey
  if (covCount > 0) {
    buffers.push(Buffer.from([0xc1])); // TAG
    const covListLen = 32 * covCount;
    buffers.push(Buffer.from([Math.floor(covListLen / 256), covListLen % 256])); // LEN (2 bytes)
    
    // VALUE: n pubkeys (each 32 bytes)
    for (const covPk of covenantPks) {
      const covBuffer = Buffer.from(covPk, 'hex');
      if (covBuffer.length !== 32) {
        throw new Error(`Invalid covenant pubkey length: ${covBuffer.length}, expected 32`);
      }
      buffers.push(covBuffer);
    }
  }

  // Cov quorum: TAG 0x01 LEN 00 01 VALUE quorum
  buffers.push(Buffer.from([0x01])); // TAG
  buffers.push(Buffer.from([0x00, 0x01])); // LEN (2 bytes)
  buffers.push(Buffer.from([covenantThreshold])); // VALUE

  // Stake timelock: TAG 0x71 LEN 00 08 VALUE timelock uint64
  buffers.push(Buffer.from([0x71])); // TAG
  buffers.push(Buffer.from([0x00, 0x08])); // LEN (2 bytes)
  // VALUE: uint64 big-endian
  const timelockBuffer = Buffer.alloc(8);
  timelockBuffer.writeUInt32BE(Math.floor(timelockBlocks / 0x100000000), 0); // 高32位
  timelockBuffer.writeUInt32BE(timelockBlocks % 0x100000000, 4); // 低32位
  buffers.push(timelockBuffer);

  return Buffer.concat(buffers as Uint8Array[]);
}

/**
 * Encodes GetVersion transaction policy parameters into a TLV (Tag-Length-Value) formatted Buffer.
 */

export function encodeGetVersionTLV(
): Buffer {
  const buffers: Buffer[] = [];

  // Action Type: TAG 0x77 LEN 00 01 VALUE action type (1=Staking)
  buffers.push(Buffer.from([0x77])); // TAG
  buffers.push(Buffer.from([0x00, 0x01])); // LEN (2 bytes)
  buffers.push(Buffer.from([0x10])); // VALUE (0x10 = GetVersion)
  return Buffer.concat(buffers as Uint8Array[]);
}