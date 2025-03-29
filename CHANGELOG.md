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