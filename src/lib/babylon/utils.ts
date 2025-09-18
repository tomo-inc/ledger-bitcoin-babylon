import { AddressType } from './types';

export function isTestnetPath(path: string): boolean {
  const parts = path.split('/');
  if (parts.length < 3) return false;
  return parts[2] === "1'";
}

export function isFullFiveLevelPath(path: string): boolean {
  const parts = path.split('/');
  return parts.length === 6 && parts[0] === 'm';
}

export function getAddressTypeFromPath(path: string): AddressType | undefined {
  const parts = path.split('/');
  if (parts.length < 2) return undefined;
  const purpose = parts[1].replace("'", "");
  switch (purpose) {
    case '86':
      return AddressType.p2tr;
    case '84':
      return AddressType.p2wpkh;
    case '49':
      return AddressType.p2sh;
    case '44':
    case '45':
      return AddressType.p2pkh;
    default:
      return undefined;
  }
}