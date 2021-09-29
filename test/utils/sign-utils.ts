import { ethers, BigNumberish, BytesLike } from "ethers";
import { keccak256, defaultAbiCoder, toUtf8Bytes, solidityPack, Bytes, _TypedDataEncoder } from "ethers/lib/utils";
import { getChainId, RSV, signData } from "./rpc";

export interface AskOrder {
    signer: string;
    token: string;
    tokenId: BigNumberish;
    amount: BigNumberish;
    strategy: string;
    currency: string;
    recipient: string;
    deadline: BigNumberish;
    params: BytesLike;
    v: BigNumberish;
    r: BytesLike;
    s: BytesLike;
}

export interface BidOrder {
    askHash: BytesLike;
    signer: string;
    amount: BigNumberish;
    price: BigNumberish;
    recipient: string;
    referrer: string;
    v: BigNumberish;
    r: BytesLike;
    s: BytesLike;
}

export const sign = (digest: any, signer: ethers.Wallet): RSV => {
    return { ...signer._signingKey().signDigest(digest) };
};

export const convertToHash = (text: string) => {
    return keccak256(toUtf8Bytes(text));
};

export const PARK_TOKEN_IDS_721_TYPEHASH = convertToHash(
    "ParkTokenIds721(address nft,uint256 toTokenId,uint256 nonce)"
);

export const MINT_BATCH_721_TYPEHASH = convertToHash(
    "MintBatch721(address nft,address to,uint256[] tokenIds,bytes data,uint256 nonce)"
);
export const MINT_BATCH_1155_TYPEHASH = convertToHash(
    "MintBatch1155(address nft,address to,uint256[] tokenIds,uint256[] amounts,bytes data,uint256 nonce)"
);

export const MINT_SOCIAL_TOKEN_TYPEHASH = convertToHash(
    "MintSocialToken(address token,address to,uint256 amount,uint256 nonce)"
);

export const ASK_TYPEHASH = convertToHash(
    "Ask(address signer,address token,uint256 tokenId,uint256 amount,address strategy,address currency,address recipient,uint256 deadline,bytes params)"
);

export const BID_TYPEHASH = convertToHash(
    "Bid(bytes32 askHash,address signer,uint256 amount,uint256 price,address recipient,address referrer)"
);

interface Domain {
    name: string;
    version: string;
    chainId: BigNumberish;
    verifyingContract: string;
}

const getDomain = async (provider: any, name: string, verifyingContract: string): Promise<Domain> => {
    const chainId = await getChainId(provider);
    return { name, version: "1", chainId, verifyingContract };
};

export const signAsk = async (
    provider: any,
    exchangeName: string, //deprecated
    exchangeAddress: string,
    signer: ethers.Wallet,
    token: string,
    tokenId: BigNumberish,
    amount: BigNumberish,
    strategy: string,
    currency: string,
    recipient: string,
    deadline: BigNumberish,
    params: BytesLike
) => {
    const hash = getHash(
        ["bytes32", "address", "address", "uint256", "uint256", "address", "address", "address", "uint256", "bytes32"],
        [
            ASK_TYPEHASH,
            signer.address,
            token,
            tokenId,
            amount,
            strategy,
            currency,
            recipient,
            deadline,
            keccak256(params),
        ]
    );
    const digest = await getDigest(provider, exchangeAddress.toLowerCase(), exchangeAddress, hash);
    const sig = sign(digest, signer);
    const order: AskOrder = {
        signer: signer.address,
        token,
        tokenId,
        amount,
        strategy,
        currency,
        recipient,
        deadline,
        params,
        v: sig.v,
        r: sig.r,
        s: sig.s,
    };
    return { hash, digest, sig, order };
};

export const signBid = async (
    provider: any,
    exchangeName: string, //deprecated
    exchangeAddress: string,
    askHash: string,
    signer: ethers.Wallet,
    amount: BigNumberish,
    price: BigNumberish,
    recipient: string,
    referrer: string
) => {
    const hash = getHash(
        ["bytes32", "bytes32", "address", "uint256", "uint256", "address", "address"],
        [BID_TYPEHASH, askHash, signer.address, amount, price, recipient, referrer]
    );
    const digest = await getDigest(provider, exchangeAddress.toLowerCase(), exchangeAddress, hash);
    const sig = sign(digest, signer);
    const order: BidOrder = {
        askHash,
        signer: signer.address,
        amount,
        price,
        recipient,
        referrer,
        v: sig.v,
        r: sig.r,
        s: sig.s,
    };
    return { hash, digest, sig, order };
};

export const domainSeparator = async (
    provider: any,
    name: string, // name is deprecated
    contractAddress: string
): Promise<string> => {
    const domain = await getDomain(provider, contractAddress.toLowerCase(), contractAddress);
    return _TypedDataEncoder.hashDomain(domain);
};

export const getMint721Digest = async (
    provider: any,
    token: string,
    recipient: string,
    tokenIds: BigNumberish[],
    data: Bytes,
    factoryAddress: string,
    nonce: BigNumberish
): Promise<string> => {
    const hash = getHash(
        ["bytes32", "address", "address", "uint256[]", "bytes", "uint256"],
        [MINT_BATCH_721_TYPEHASH, token, recipient, tokenIds, data, nonce]
    );
    const digest = await getDigest(provider, "TokenFactory", factoryAddress, hash);
    return digest;
};

export const getPark721Digest = async (
    provider: any,
    token: string,
    toTokenId: BigNumberish,
    factoryAddress: string,
    nonce: BigNumberish
): Promise<string> => {
    const hash = getHash(
        ["bytes32", "address", "uint256", "uint256"],
        [PARK_TOKEN_IDS_721_TYPEHASH, token, toTokenId, nonce]
    );
    const digest = await getDigest(provider, "TokenFactory", factoryAddress, hash);
    return digest;
};

export const getMint1155Digest = async (
    provider: any,
    token: string,
    recipient: string,
    tokenIds: BigNumberish[],
    amounts: BigNumberish[],
    data: Bytes,
    factoryAddress: string,
    nonce: BigNumberish
): Promise<string> => {
    const hash = getHash(
        ["bytes32", "address", "address", "uint256[]", "uint256[]", "bytes", "uint256"],
        [MINT_BATCH_1155_TYPEHASH, token, recipient, tokenIds, amounts, data, nonce]
    );
    const digest = await getDigest(provider, "TokenFactory", factoryAddress, hash);
    return digest;
};

export const getMintSocialTokenDigest = async (
    provider: any,
    token: string,
    recipient: string,
    amount: BigNumberish,
    factoryAddress: string,
    nonce: BigNumberish
): Promise<string> => {
    const hash = getHash(
        ["bytes32", "address", "address", "uint256", "uint256"],
        [MINT_SOCIAL_TOKEN_TYPEHASH, token, recipient, amount, nonce]
    );
    const digest = await getDigest(provider, "TokenFactory", factoryAddress, hash);
    return digest;
};

export const getHash = (types: string[], values: any[]): string => {
    return keccak256(defaultAbiCoder.encode(types, values));
};

export const getDigest = async (
    provider: any,
    name: string,   // name is deprecated
    contractAddress: string,
    hash: BytesLike
): Promise<string> => {
    return keccak256(
        solidityPack(
            ["bytes1", "bytes1", "bytes32", "bytes32"],
            ["0x19", "0x01", await domainSeparator(provider, name, contractAddress), hash]
        )
    );
};
