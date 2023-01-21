import { Cell, beginCell, Address, beginDict, Slice, toNano } from "ton";

let contentSlice2 : Slice;



enum OPS {
    ChangeAdmin = 3,
    ReplaceMetadata = 4,
    Mint = 21,
    InternalTransfer = 0x178d4519,
    Transfer = 0xf8a7ea5,
    Burn = 0x595f07bc,
}

export type JettonMetaDataKeys =
    | "name"
    | "description"
    | "image"
    | "symbol"
    | "image_data"
    | "decimals";

async function parseJettonOffchainMetadata(contentSlice: Slice): Promise<{
    metadata: { [s in JettonMetaDataKeys]?: string };
    isIpfs: boolean;
}> {
    const jsonURI = contentSlice
        .loadBits(await () => (contentSlice.remainingBits()))
        .toString("ascii")
        .replace("ipfs://", "https://ipfs.io/ipfs/");

    return {
        metadata: (await axios.get(jsonURI)).data,
        isIpfs: /(^|\/)ipfs[.:]/.test(jsonURI),
    };
}