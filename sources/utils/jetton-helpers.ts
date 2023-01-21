import {Address, Cell, Builder, beginCell} from "ton";

const ONCHAIN_CONTENT_PREFIX = 0x00;
const SNAKE_PREFIX = 0x00;

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
    let rootCell = beginCell();
    let dict = new Cell();

    Object.entries(data).forEach(([k, v]: [string, string | undefined]) => {
        if (!jettonOnChainMetadataSpec[k as JettonMetaDataKeys])
            throw new Error(`Unsupported onchain key: ${k}`);
        if (v === undefined || v === "") return;

        let bufferToStore = Buffer.from(v, jettonOnChainMetadataSpec[k as JettonMetaDataKeys]);

        const CELL_MAX_SIZE_BYTES = Math.floor((1023 - 8) / 8);

        rootCell.storeUint(SNAKE_PREFIX, 16);
        let currentCell = rootCell;

        //TODO need fix dictionary writing
        while (bufferToStore.length > 0) {
            currentCell.storeBits(bufferToStore.read(CELL_MAX_SIZE_BYTES)) // how to read from Buffer???
            //currentCell.bits.writeBuffer(bufferToStore.slice(0, CELL_MAX_SIZE_BYTES));
            //bufferToStore = bufferToStore.slice(CELL_MAX_SIZE_BYTES);
            if (bufferToStore.length > 0) {
                const newCell = new Builder();
                newCell.storeRef(currentCell);
                currentCell = newCell;
            }
        }
        let dict = currentCell.endCell();
    });
    return beginCell().storeInt(ONCHAIN_CONTENT_PREFIX, 8).storeDict(dict).endCell();
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