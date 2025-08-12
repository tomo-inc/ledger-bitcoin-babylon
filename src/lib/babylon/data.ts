
/*
TAG=1 LEN=2 Value
Action Type:  2=Staking 3=Unbond 0=SLASHING 1=UNBONDING SLASHING
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
txid:                         TAG 0x35  LEN 00 20      VALUE txid BUFFER
burning address:              TAG 0x36  LEN 00 XX      VALUE address BUFFER
*/

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
  timelockBlocks: number,
  finalityProviders: string[],
  covenantThreshold: number,
  covenantPks: string[],
  slashingPkScriptHex: string,
  fee: number
): Buffer {
  const buffers: Buffer[] = [];

  // Action Type: TAG 0x77 LEN 00 01 VALUE action type (0=SLASHING)
  buffers.push(Buffer.from([0x77])); // TAG
  buffers.push(Buffer.from([0x00, 0x01])); // LEN (2 bytes)
  buffers.push(Buffer.from([0x00])); // VALUE (0 = SLASHING)

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
