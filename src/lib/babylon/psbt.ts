import * as crypto from 'crypto';

import { Psbt } from 'bitcoinjs-lib';

export function getTaprootScript(base64PSBT: string): Buffer | undefined {
  const psbtBuffer = Buffer.from(base64PSBT, 'base64');

  const psbt = Psbt.fromBuffer(psbtBuffer);

  for (const input of psbt.data.inputs) {
    // console.log(input);
    if (input.tapLeafScript && input.tapLeafScript.length > 0) {
      for (const leafScript of input.tapLeafScript) {
        return leafScript.script;
      }
    }
  }

  return undefined;
}

// BIP341 Tagged Hash
function taggedHash(tag: Buffer, data: Buffer): Buffer {
  const tagHash = crypto.createHash('sha256').update(tag).digest();
  return crypto
    .createHash('sha256')
    .update(Buffer.concat([tagHash, tagHash, data]))
    .digest();
}


function encodeVarint(n: number): Buffer {
  if (n < 0xfd) {
    return Buffer.from([n]);
  } else if (n <= 0xffff) {
    const buf = Buffer.alloc(3);
    buf.writeUInt8(0xfd, 0);
    buf.writeUInt16LE(n, 1);
    return buf;
  } else if (n <= 0xffffffff) {
    const buf = Buffer.alloc(5);
    buf.writeUInt8(0xfe, 0);
    buf.writeUInt32LE(n, 1);
    return buf;
  } else {
    const buf = Buffer.alloc(9);
    buf.writeUInt8(0xff, 0);
    buf.writeUInt32LE(n, 1);
    buf.writeBigUInt64LE(BigInt(n), 5);
    return buf;
  }
}

export function getLeafHash(scriptBytes: Buffer) {
  const leafVersion = Buffer.from([0xc0]);
  const scriptLen = scriptBytes.length;
  const varintLen = encodeVarint(scriptLen);
  const toHash = Buffer.concat([leafVersion, varintLen, scriptBytes]);
  const leafHash = taggedHash(Buffer.from('TapLeaf'), toHash);
  return leafHash;
}


