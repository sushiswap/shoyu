import { getChainId, RSV, signData } from "./rpc";

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

const getDomain = async (
  provider: any,
  name: string,
  verifyingContract: string
): Promise<Domain> => {
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
    params,
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
