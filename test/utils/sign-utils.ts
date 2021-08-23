import { ethers } from "ethers";
import { keccak256, defaultAbiCoder, toUtf8Bytes, solidityPack, Bytes, _TypedDataEncoder } from "ethers/lib/utils";
import { getChainId, RSV, signData } from "./rpc";
// import { ecsign } from "ethereumjs-util";

export const sign = (digest: any, signer: ethers.Wallet): RSV => {
    return {...signer._signingKey().signDigest(digest)};
};

export const convertToHash = (text: string) => {
    return keccak256(toUtf8Bytes(text));
};

export const PARK_TOKEN_IDS_721_TYPEHASH = convertToHash("ParkTokenIds721(address nft,uint256 toTokenId,uint256 nonce)");

export const MINT_BATCH_721_TYPEHASH = convertToHash(
    "MintBatch721(address nft,address to,uint256[] tokenIds,bytes data,uint256 nonce)"
);
export const MINT_BATCH_1155_TYPEHASH = convertToHash(
    "MintBatch1155(address nft,address to,uint256[] tokenIds,uint256[] amounts,bytes data,uint256 nonce)"
);

interface Domain {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
}

interface AskMessage {
    signer: string;
    token: string;
    tokenId: number;
    amount: number;
    strategy: string;
    currency: string;
    recipient: string;
    deadline: number;
    params: string;
}

interface BidMessage {
    askHash: string;
    signer: string;
    amount: number;
    price: number;
    recipient: string;
    referrer: string;
}

const EIP712Domain = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
];

const createAskData = (message: AskMessage, domain: Domain) => {
    return {
        types: {
            EIP712Domain,
            AskMessage: [
                { name: "signer", type: "address" },
                { name: "token", type: "address" },
                { name: "tokenId", type: "uint256" },
                { name: "amount", type: "uint256" },
                { name: "strategy", type: "address" },
                { name: "currency", type: "address" },
                { name: "recipient", type: "address" },
                { name: "deadline", type: "uint256" },
                { name: "params", type: "bytes32" },
            ],
        },
        primaryType: "AskMessage",
        domain,
        message,
    };
};

const createBidData = (message: BidMessage, domain: Domain) => {
    return {
        types: {
            EIP712Domain,
            BidMessage: [
                { name: "askHash", type: "bytes32" },
                { name: "signer", type: "address" },
                { name: "amount", type: "uint256" },
                { name: "price", type: "uint256" },
                { name: "recipient", type: "address" },
                { name: "referrer", type: "address" },
            ],
        },
        primaryType: "BidMessage",
        domain,
        message,
    };
};

const getDomain = async (provider: any, name: string, verifyingContract: string): Promise<Domain> => {
    const chainId = await getChainId(provider);
    return { name, version: "1", chainId, verifyingContract };
};

export const signAsk = async (
    provider: any,
    exchangeName: string,
    exchangeAddress: string,
    signer: string,
    token: string,
    tokenId: number,
    amount: number,
    strategy: string,
    currency: string,
    recipient: string,
    deadline: number,
    params: string
): Promise<AskMessage & RSV> => {
    const message: AskMessage = {
        signer,
        token,
        tokenId,
        amount,
        strategy,
        currency,
        recipient,
        deadline,
        params: ethers.utils.keccak256(params),
    };

    const domain = await getDomain(provider, exchangeName, exchangeAddress);
    const typedData = createAskData(message, domain);
    const sig = await signData(provider, signer, typedData);

    return { ...sig, ...message };
};

export const signBid = async (
    provider: any,
    exchangeName: string,
    exchangeAddress: string,
    askHash: string,
    signer: string,
    amount: number,
    price: number,
    recipient: string,
    referrer: string
): Promise<BidMessage & RSV> => {
    const message: BidMessage = {
        askHash,
        signer,
        amount,
        price,
        recipient,
        referrer,
    };

    const domain = await getDomain(provider, exchangeName, exchangeAddress);
    const typedData = createBidData(message, domain);
    const sig = await signData(provider, signer, typedData);

    return { ...sig, ...message };
};

export const domainSeparator = async (provider: any, name: string, contractAddress: string): Promise<string> => {
    const domain = await getDomain(provider, name, contractAddress);
    return _TypedDataEncoder.hashDomain(domain);
};

export const getMint721Digest = async (
    provider: any,
    token: string,
    recipient: string,
    tokenIds: number[],
    data: Bytes,
    factoryAddress: string,
    nonce: number
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
    toTokenId: number,
    factoryAddress: string,
    nonce: number
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
    tokenIds: number[],
    amounts: number[],
    data: Bytes,
    factoryAddress: string,
    nonce: number
): Promise<string> => {
    const hash = getHash(
        ["bytes32", "address", "address", "uint256[]", "uint256[]", "bytes", "uint256"],
        [MINT_BATCH_1155_TYPEHASH, token, recipient, tokenIds, amounts, data, nonce]
    );
    const digest = await getDigest(provider, "TokenFactory", factoryAddress, hash);
    return digest;
};

export const getHash = (types: string[], values: any[]): string => {
    return keccak256(defaultAbiCoder.encode(types, values));
};

export const getDigest = async (provider: any, name: string, contractAddress: string, hash: string): Promise<string> => {
    return keccak256(
        solidityPack(
            ["bytes1", "bytes1", "bytes32", "bytes32"],
            ["0x19", "0x01", await domainSeparator(provider, name, contractAddress), hash]
        )
    );
};
