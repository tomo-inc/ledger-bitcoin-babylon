import Transport from '@ledgerhq/hw-transport-node-speculos-http';
import { AppClient,DefaultWalletPolicy,PsbtV2 } from '..';
import { /*stakingTxPolicy, */slashingPathPolicy } from '../lib/babylon/index';

describe('stakingTxPolicy', () => {
  let transport: any;
  let app: AppClient;

  beforeAll(async () => {
    transport = await Transport.open('http://127.0.0.1:5000' as any);
    app = new AppClient(transport);
  });

  afterAll(async () => {
    if (transport) await transport.close();
  });

  // it('should create staking tx policy and send TLV data', async () => {
  //   const params = {
  //     timelockBlocks: 64000,
  //     finalityProviders: ['1f93235732e64cac33569ad1c3dbf041382c3b774fcfb0533b9b31d4c2a76bf9'],
  //     covenantThreshold: 6,
  //     covenantPks: [
  //       '0aee0509b16db71c999238a4827db945526859b13c95487ab46725357c9a9f25',
  //       '113c3a32a9d320b72190a04a020a0db3976ef36972673258e9a38a364f3dc3b0',
  //       '17921cf156ccb4e73d428f996ed11b245313e37e27c978ac4d2cc21eca4672e4',
  //       '3bb93dfc8b61887d771f3630e9a63e97cbafcfcc78556a474df83a31a0ef899c',
  //       '40afaf47c4ffa56de86410d8e47baa2bb6f04b604f4ea24323737ddc3fe092df',
  //       '79a71ffd71c503ef2e2f91bccfc8fcda7946f4653cef0d9f3dde20795ef3b9f0',
  //       '8c1e7e2b5c6d4f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a',
  //       '9f8e7d6c5b4a39281716151413121110ffeeddccbbaa99887766554433221100',
  //       'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  //     ],
  //   };

  //   const policy = await stakingTxPolicy({
  //     policyName: 'Staking transaction',
  //     transport,
  //     params,
  //     derivationPath: `m/86'/1'/0'`,
  //     isTestnet: true,
  //   });

  //   expect(policy).toBeDefined();
  //   expect(policy.descriptorTemplate).toBe('tr(@0/**)');
  // });

  it('should create slashing tx policy and send TLV data', async () => {
    const params = {
      timelockBlocks: 1008,
      finalityProviders: ['d66124f8f42fd83e4c901a100ae3b5d706ef6cfd217b04bc64152e739a30c41e'],
      covenantThreshold: 6,
      covenantPks: [
        '0aee0509b16db71c999238a4827db945526859b13c95487ab46725357c9a9f25',
        '113c3a32a9d320b72190a04a020a0db3976ef36972673258e9a38a364f3dc3b0',
        '17921cf156ccb4e73d428f996ed11b245313e37e27c978ac4d2cc21eca4672e4',
        '3bb93dfc8b61887d771f3630e9a63e97cbafcfcc78556a474df83a31a0ef899c',
        '40afaf47c4ffa56de86410d8e47baa2bb6f04b604f4ea24323737ddc3fe092df',
        '79a71ffd71c503ef2e2f91bccfc8fcda7946f4653cef0d9f3dde20795ef3b9f0',
        'd21faf78c6751a0d38e6bd8028b907ff07e9a869a43fc837d6b3f8dff6119a36',
        'f5199efae3f28bb82476163a7e458c7ad445d9bffb0682d10d3bdb2cb41f8e8e',
        'fa9d882d45f4060bdb8042183828cd87544f1ea997380e586cab77d5fd698737',
      ],
      slashingFeeSat: 2000,
      leafHash: Buffer.from('ed429f93af8bb724a9f5066248b32d945fdd1c12f7f59a33f4f83b6565716750', 'hex'),
      slashingPkScriptHex: "00145be12624d08a2b424095d7c07221c33450d14bf1",
    };

    const policy = await slashingPathPolicy({
      policyName: 'Consent to slashing',
      transport,
      params,
      derivationPath: `m/86'/1'/0'`,
      displayLeafHash: false,
      isTestnet: true,
    });

    expect(policy).toBeDefined();
    expect(policy.descriptorTemplate).toBe('tr(@0/**)');
  });

  it("can sign a psbt", async () => {
        // psbt from test_sign_psbt_singlesig_wpkh_2to2 in the main test suite, converted to PSBTv2
        // const psbtBuf = Buffer.from(
        //   "cHNidP8BAIkCAAAAAQoDdUgOA5oDhvrH0NWZTa/GJzvd4UhFIbmbOiWufc84AAAAAAD/////AlDDAAAAAAAAIlEg12Pea0ceMFZBukHWXGeC6MvP9uCOg9qrDaEnW7yfqtAcAi0AAAAAACJRIHQO5k5FLjuu4SewPBlbzCGtPt3tLvJsWvSD2cVjBNHlAAAAAAABASvAxi0AAAAAACJRIHQO5k5FLjuu4SewPBlbzCGtPt3tLvJsWvSD2cVjBNHlARcg3I0vnv8MT0294HCkjjMO/JCLYqdmVo2R5ljyhLMkuHgAAAA=",
        //   "base64"
        // );
        const psbtBuf = Buffer.from(
           "cHNidP8BAH0CAAAAAU5oPucfQQOAdrEZwJODBvpzHfaA/orEXxwbxelbMexgAAAAAAD/////AsQJAAAAAAAAFgAUW+EmJNCKK0JAldfAciHDNFDRS/EEpgAAAAAAACJRICyVutUKY9E6qBjfjktoZBga2/RyCoiq+OPBI1ugik2fAAAAAAABAStQwwAAAAAAACJRINdj3mtHHjBWQbpB1lxngujLz/bgjoPaqw2hJ1u8n6rQQhXBUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsCJtgX5iDHD5SbZ6yF5ZRRSk4qMD/f16u7MthJR1dRt6/15ASDcjS+e/wxPTb3gcKSOMw78kItip2ZWjZHmWPKEsyS4eK0g1mEk+PQv2D5MkBoQCuO11wbvbP0hewS8ZBUuc5owxB6tIAruBQmxbbccmZI4pIJ9uUVSaFmxPJVIerRnJTV8mp8lrCARPDoyqdMgtyGQoEoCCg2zl27zaXJnMljpo4o2Tz3DsLogF5Ic8VbMtOc9Qo+ZbtEbJFMT434nyXisTSzCHspGcuS6IDu5PfyLYYh9dx82MOmmPpfLr8/MeFVqR034OjGg74mcuiBAr69HxP+lbehkENjke6ortvBLYE9OokMjc33cP+CS37ogeacf/XHFA+8uL5G8z8j82nlG9GU87w2fPd4geV7zufC6INIfr3jGdRoNOOa9gCi5B/8H6ahppD/IN9az+N/2EZo2uiD1GZ764/KLuCR2Fjp+RYx61EXZv/sGgtENO9sstB+Ojrog+p2ILUX0BgvbgEIYOCjNh1RPHqmXOA5YbKt31f1phze6VpzAARcgUJKbdMGgSVS3i0tgNel6XgeKWg8o7JbVR7/ums6AOsAAAAA=",
           "base64"
         );
  
        //const automation = JSON.parse(fs.readFileSync('src/__tests__/automations/sign_with_wallet_accept.json').toString());
       // await setSpeculosAutomation(transport, automation);
    
        const walletPolicy = new DefaultWalletPolicy(
          "tr(@0/**)",
          "[f5acc2fd/86'/1'/0']tpubDDKYE6BREvDsSWMazgHoyQWiJwYaDDYPbCFjYxN3HFXJP5fokeiK4hwK5tTLBNEDBwrDXn8cQ4v9b2xdW62Xr5yxoQdMu1v6c7UDXYVH27U"
        );
    
        const psbt = new PsbtV2();
        psbt.deserialize(psbtBuf);
        const result = await app.signPsbt(psbt, walletPolicy, null, () => {});
    
        expect(result.length).toEqual(1);
      });
});