import { beginCell, contractAddress, toNano, TonClient, TonClient4, Address,  WalletContractV4, internal, fromNano, Cell} from "ton";
import {mnemonicToPrivateKey} from "ton-crypto";
import {buildOnchainMetadata} from "./utils/jetton-helpers";
import {SampleJetton} from "./output/jetton_SampleJetton";


(async () => { //need changes for jetton

    //create client for testnet Toncenter API
    const client = new TonClient({
        endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: 'bb38df0c2756c66e2ab49f064e2484ec444b01244d2bd49793bd5b58f61ae3d2'
    })

    //create client for testnet sandboxv4 API - alternative endpoint
    const client4 = new TonClient4({
        endpoint: "https://sandbox-v4.tonhubapi.com"
    })

    // Insert your test wallet's 24 words, make sure you have some test Toncoins on its balance. Every deployment spent 0.5 test toncoin.
    let mnemonics = "multiply voice predict admit hockey fringe flat bike napkin child quote piano";
    // read more about wallet apps https://ton.org/docs/participate/wallets/apps#tonhub-test-environment

    let keyPair = await mnemonicToPrivateKey(mnemonics.split(" "));
    let secretKey = keyPair.secretKey;
    //workchain = 1 - masterchain (expensive operation cost, validator's election contract works here)
    //workchain = 0 - basechain (normal operation cost, user's contracts works here)
    let workchain = 0; //we are working in basechain.

    //Create deployment wallet contract
    let wallet = WalletContractV4.create({ workchain, publicKey: keyPair.publicKey});
    let contract = client4.open(wallet);

    // Get deployment wallet balance
    let balance: bigint = await contract.getBalance();

    // This is example data - Modify these params for your own jetton
    // - Data is stored on-chain (except for the image data itself)

    const jettonParams = {
        name: "TactJet",
        description: "This is description of Test tact jetton",
        image: "https://ipfs.io/ipfs/QmbPZjC1tuP6ickCCBtoTCQ9gc3RpkbKx7C1LMYQdcLwti" // Image url
    };

    // Owner should usually be the deploying wallet's address.
    let owner = Address.parse('kQDND6yHEzKB82ZGRn58aY9Tt_69Ie_uz73e2V...');


    // Create content Cell
    let content = buildOnchainMetadata(jettonParams);

    // Compute init data for deployment
    let init = await SampleJetton.init(owner, content);
    let destination_address = contractAddress(workchain, init);


    let deployAmount = toNano('0.5');
    let supply = 500;
    let amount = BigInt(supply * Math.pow(10, 9));


    // send a message on new address contract to deploy it
    let seqno: number = await contract.getSeqno();

    //TL-B mint#01fb345b amount:int257 = Mint
    let msg = beginCell().storeBuffer(Buffer.from("01fb345b", "hex")).storeInt(amount, 257).endCell();

    console.log('🛠️Preparing new outgoing massage from deployment wallet. Seqno = ', seqno);
    console.log('Current deployment wallet balance = ', fromNano(balance).toString(), '💎TON');
    console.log('Totally supply for deployed Token = ', supply, ', amount = ', amount.toString());
    await contract.sendTransfer({
        seqno,
        secretKey,
        messages: [internal({
            value: deployAmount,
            to: destination_address,
            init: {
                code : init.code,
                data : init.data
            },
            body: msg
        })]
    });
    console.log('======deployment message sent to ', destination_address, ' ======');
})();
