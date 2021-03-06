/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import { Provider } from "@ethersproject/providers";
import type { IStrategy, IStrategyInterface } from "../IStrategy";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "proxy",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "params",
        type: "bytes",
      },
      {
        internalType: "address",
        name: "bidder",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "bidPrice",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "bestBidder",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "bestBidPrice",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "bestBidTimestamp",
        type: "uint256",
      },
    ],
    name: "canBid",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "proxy",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "params",
        type: "bytes",
      },
      {
        internalType: "address",
        name: "bidder",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "bidPrice",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "bestBidder",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "bestBidPrice",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "bestBidTimestamp",
        type: "uint256",
      },
    ],
    name: "canClaim",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

export class IStrategy__factory {
  static readonly abi = _abi;
  static createInterface(): IStrategyInterface {
    return new utils.Interface(_abi) as IStrategyInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IStrategy {
    return new Contract(address, _abi, signerOrProvider) as IStrategy;
  }
}
