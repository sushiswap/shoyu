/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import { Provider } from "@ethersproject/providers";
import type {
  INFTContractURIdentifiable,
  INFTContractURIdentifiableInterface,
} from "../INFTContractURIdentifiable";

const _abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "string",
        name: "uri",
        type: "string",
      },
    ],
    name: "SetContractURI",
    type: "event",
  },
  {
    inputs: [],
    name: "contractURI",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "_contractURI",
        type: "string",
      },
    ],
    name: "setContractURI",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

export class INFTContractURIdentifiable__factory {
  static readonly abi = _abi;
  static createInterface(): INFTContractURIdentifiableInterface {
    return new utils.Interface(_abi) as INFTContractURIdentifiableInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): INFTContractURIdentifiable {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as INFTContractURIdentifiable;
  }
}
