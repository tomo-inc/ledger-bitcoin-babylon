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