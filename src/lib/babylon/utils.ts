import { fromBech32 } from '@cosmjs/encoding';
import { getLeafHash, getTaprootScript } from './psbt';
import { base64 } from '@scure/base';
const TimelockPathRegex1 =
  /^([a-f0-9]{64}) OP_CHECKSIGVERIFY OP_(0|[1-9]|1[0-6]) OP_CHECKSEQUENCEVERIFY$/;

function _tryParseNumber(number: string): string {
  if (number.length % 2 !== 0) {
    throw new Error('Invalid timelock: odd-length hex string');
  }
  return number.match(/.{2}/g)?.reverse().join('') ?? '';
}

export function tryParseTimelockPath(decoded: string[]): string[] | void {
  const script = decoded.join(' ');

  let match = script.match(TimelockPathRegex1);
  if (match) {
    const [stakerPK, timelockBlocks] = match;
    return [stakerPK, Number(timelockBlocks).toString(16)];
  }

//   match = script.match(TimelockPathRegex2);
//   if (!match) {
//     return;
//   }

  const [_, stakerPK, timelockBlocks] = match;

  return [stakerPK, _tryParseNumber(timelockBlocks)];
}



export function validadteAddress(input: string): Uint8Array | void {
  try {
    const { prefix, data } = fromBech32(input);
    if (prefix == 'bbn' && data.length === 20) {
      return data;
    }
  } catch (e) {
    //
  }
}

export function computeLeafHash(psbt: Uint8Array | string): Buffer {
  const psbtBase64 = psbt instanceof Uint8Array ? base64.encode(psbt) : psbt;
  const script = getTaprootScript(psbtBase64);
  if (!script) {
    throw new Error('The psbt does not contain a taproot script.');
  }
  return getLeafHash(script);
}
