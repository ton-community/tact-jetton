import { beginCell, contractAddress, toNano, TonClient, TonClient4, Address,  WalletContractV4, internal, fromNano} from "ton";
import {mnemonicToPrivateKey} from "ton-crypto";
import {JettonMetaDataKeys} from 'utils/jetton-helpers';





(async () => { //need changes for jetton

    // This is example data - Modify these params for your own jetton!
    // - Data is stored on-chain (except for the image data itself)
    // - Owner should usually be the deploying wallet's address.
    const jettonParams = {
        name: "MyJetton",
        symbol: "JET1",
        image: "https://www.linkpicture.com/q/download_183.png", // Image url
        description: "My jetton",
    };



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
    let mnemonics = "multiply voice predict admit hockey fringe flat bike napkin child quote piano year cloud bundle lunch....";
    // read more about wallet apps https://ton.org/docs/participate/wallets/apps#tonhub-test-environment

    let keyPair = await mnemonicToPrivateKey(mnemonics.split(" "));
    let secretKey = keyPair.secretKey;
    //workchain = 1 - masterchain (expensive operation cost, validator's election contract works here)
    //workchain = 0 - basechain (normal operation cost, user's contracts works here)
    let workchain = 0; //we are working in basechain.

    //Create deployment wallet contract
    let wallet = WalletContractV4.create({ workchain, publicKey: keyPair.publicKey});
    let contract = client.open(wallet);

    // Get deployment wallet balance
    let balance: bigint = await contract.getBalance();


    // Generate define owner of Jetton contract
    let owner = Address.parse('kQDND6yHEzKB82ZGRn58aY9Tt_69Ie_uz73e2VuuJ3fVVcxf');

    // Create content Cell
    let content = beginCell().storeUint()

    // Compute init for deployment
    let init = await SampleJetton.init(owner, content);

    // send a message on new address contract to deploy it
    let seqno: number = await contract.getSeqno();
    console.log('🛠️Preparing new outgoing massage from deployment wallet. Seqno = ', seqno);
    console.log('Current deployment wallet balance = ', fromNano(balance).toString(), '💎TON');
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
            body: 'Deploy'
        })]
    });
    console.log('======deployment message sent to ', destination_address, ' ======');
})();


export type JettonMetaDataKeys = "name" | "description" | "image" | "symbol";

const jettonOnChainMetadataSpec: {
    [key in JettonMetaDataKeys]: "utf8" | "ascii" | undefined;
} = {
    name: "utf8",
    description: "utf8",
    image: "ascii",
    symbol: "utf8",
};

const sha256 = (str: string) => {
    const sha = new Sha256();
    sha.update(str);
    return Buffer.from(sha.digestSync());
};

export function buildTokenMetadataCell(data: { [s: string]: string | undefined }): Cell {
    const KEYLEN = 256;
    const dict = beginDict(KEYLEN);

    Object.entries(data).forEach(([k, v]: [string, string | undefined]) => {
        if (!jettonOnChainMetadataSpec[k as JettonMetaDataKeys])
            throw new Error(`Unsupported onchain key: ${k}`);
        if (v === undefined || v === "") return;

        let bufferToStore = Buffer.from(v, jettonOnChainMetadataSpec[k as JettonMetaDataKeys]);

        const CELL_MAX_SIZE_BYTES = Math.floor((1023 - 8) / 8);

        const rootCell = new Cell();
        rootCell.bits.writeUint8(SNAKE_PREFIX);
        let currentCell = rootCell;

        while (bufferToStore.length > 0) {
            currentCell.bits.writeBuffer(bufferToStore.slice(0, CELL_MAX_SIZE_BYTES));
            bufferToStore = bufferToStore.slice(CELL_MAX_SIZE_BYTES);
            if (bufferToStore.length > 0) {
                const newCell = new Cell();
                currentCell.refs.push(newCell);
                currentCell = newCell;
            }
        }

        dict.storeRef(sha256(k), rootCell);
    });

    return beginCell().storeInt(ONCHAIN_CONTENT_PREFIX, 8).storeDict(dict.endDict()).endCell();
}

export function parseTokenMetadataCell(contentCell: Cell): {
    [s in JettonMetaDataKeys]?: string;
} {
    // Note that this relies on what is (perhaps) an internal implementation detail:
    // "ton" library dict parser converts: key (provided as buffer) => BN(base10)
    // and upon parsing, it reads it back to a BN(base10)
    // tl;dr if we want to read the map back to a JSON with string keys, we have to convert BN(10) back to hex
    const toKey = (str: string) => new BN(str, "hex").toString(10);

    const KEYLEN = 256;
    const contentSlice = contentCell.beginParse();
    if (contentSlice.readUint(8).toNumber() !== ONCHAIN_CONTENT_PREFIX)
        throw new Error("Expected onchain content marker");

    const dict = contentSlice.readDict(KEYLEN, (s) => {
        const buffer = Buffer.from("");

        const sliceToVal = (s: Slice, v: Buffer, isFirst: boolean) => {
            s.toCell().beginParse();
            if (isFirst && s.readUint(8).toNumber() !== SNAKE_PREFIX)
                throw new Error("Only snake format is supported");

            v = Buffer.concat([v, s.readRemainingBytes()]);
            if (s.remainingRefs === 1) {
                v = sliceToVal(s.readRef(), v, false);
            }

            return v;
        };

        return sliceToVal(s.readRef(), buffer, true);
    });

    const res: { [s in JettonMetaDataKeys]?: string } = {};

    Object.keys(jettonOnChainMetadataSpec).forEach((k) => {
        const val = dict
            .get(toKey(sha256(k).toString("hex")))
            ?.toString(jettonOnChainMetadataSpec[k as JettonMetaDataKeys]);
        if (val) res[k as JettonMetaDataKeys] = val;
    });

    return res;
}

export function jettonMinterInitData(
    owner: Address,
    metadata: { [s in JettonMetaDataKeys]?: string }
): Cell {
    return beginCell()
        .storeCoins(0)
        .storeAddress(owner)
        .storeRef(buildTokenMetadataCell(metadata))
        .storeRef(JETTON_WALLET_CODE)
        .endCell();
}

// return the init Cell of the contract storage (according to load_data() contract method)
export function initData() {
    return jettonMinterInitData(jettonParams.owner, {
        name: jettonParams.name,
        symbol: jettonParams.symbol,
        image: jettonParams.image,
        description: jettonParams.description,
    });
}

// return the op that should be sent to the contract on deployment, can be "null" to send an empty message
export function initMessage() {
    return null; // TODO?
}

// optional end-to-end sanity test for the actual on-chain contract to see it is actually working on-chain
export async function postDeployTest(
    walletContract: WalletContract,
    secretKey: Buffer,
    contractAddress: Address
) {
    const call = await walletContract.client.callGetMethod(contractAddress, "get_jetton_data");

    console.log(
        parseTokenMetadataCell(
            Cell.fromBoc(Buffer.from(call.stack[3][1].bytes, "base64").toString("hex"))[0]
        )
    );
}
