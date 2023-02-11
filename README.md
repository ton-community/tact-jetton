# TACT jetton demo

![Jetton demo logo](https://ipfs.io/ipfs/QmbPZjC1tuP6ickCCBtoTCQ9gc3RpkbKx7C1LMYQdcLwti)

This project has ready to use TACT compiler, typescript + jest with ton-contract-executor, example how to do tests.
To run deployment of `jetton.tact` example on testnet, you need input your deployment wallet seed [here](https://github.com/Reveloper/tact-jetton/blob/main/sources/jetton.deploy.ts#L20) and owner address [here](https://github.com/Reveloper/tact-jetton/blob/main/sources/jetton.deploy.ts#L46).
Note, that in deployment script is using walletV4. If you want to use your V3R2, you need change wallet contract [here](https://github.com/Reveloper/tact-jetton/blob/main/sources/jetton.deploy.ts#L31).

```bash
yarn test # To test contract
yarn build # To build contract
yarn deploy # To deploy contract (need input deployment wallet)
```

## Licence

MIT
