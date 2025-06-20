# Changelog

## [v0.3.0-alpha.5] - 2025-06-20

### Fixed
- Better finality provider error message with more descriptive information
- Fixed lint issues and ensured method inputs are not mutated

## [v0.3.0-alpha.4] - 2025-06-16

### Fixed
- Updated error message to use correct app name 'Babylon BTC Test'
- Added padding to the slashing public key script hex to ensure it's 64 characters long
- Sorted covenantPks

## [v0.3.0-alpha.3] - 2025-06-13

### Fixed
- Updated testnet app name check from 'Bitcoin Test' to 'Babylon BTC Test'

## [v0.3.0-alpha.2] - 2025-06-12

### Changed
- Updated TypeScript configuration for better type checking and module resolution

### Fixed
- Moved bitcoinjs to peer dependency

## [v0.3.0-alpha.1] - 2025-06-11

### Changed
- Moved `bitcoinjs-lib` from `dependencies` to `peerDependencies`

## [v0.3.0-alpha.0] - 2025-06-08

### Changed
- **SlashingParams**
  - Removed `finalityProviderPk: string`
  - Added `finalityProviders: string[]`
  - Added `timelockBlocks: number`
  - Added `slashingPkScriptHex: string`
  - Added `slashingFeeSat: number`

- **UnbondingParams**
  - Removed `finalityProviderPk: string`
  - Added `finalityProviders: string[]`
  - Added `timelockBlocks: number`
  - Added `unbondingFeeSat: number`

- **StakingTxParams**
  - Removed `finalityProviderPk: string`
  - Added `finalityProviders: string[]`
  - Added `timelockBlocks: number`

## [0.2.9] - 2025-04-17

### Changed
- Updated the policy name for slashing and the app name.

## [0.2.8] - 2025-04-04

### Fixed
- Resolved timelock encoding parsing issue and ensured compatibility with both supported formats.

## [0.2.7] - 2025-04-02

### Breaking Changes
- Removed auto-parsing of unbonding path. Now requires additional data beyond PSBT.

### Added
- Extended `unbondingPathPolicy` with extra parameters to pass finality provider public key and timelock.
- Updated README with a usage example for `unbondingPathPolicy`.

## [0.2.6] - 2025-04-01

### Changed
- Updated the policy name for slashing and unbonding.

## [0.2.5] - 2025-03-30

### Fixed
- The message to sign should be a valid bbn address.

## [0.2.4] - 2025-03-29

### Added
- Implemented signing for BIP322 message for taproot.

### Changed
- Updated `signMessage` parameters for consistency.
  - **Note:** Only the API interface is affected; the calling style remains unchanged.

### Refactored
- Renamed `_formatKey` to `formatKey` and exported it.
- Extracted `enum MagicCode` to the `types` module.

### Fixed
- Updated lower bound for quorum value.

## [0.2.2] - 2025-03-20

### Changed
- Added a custom wallet policy for message signing and enhanced the `signMessage` interface.
- Updated README with more detailed SDK usage instructions.

### Fixed
- Resolved issues with module imports and exports.