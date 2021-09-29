/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type {
  ERC20Initializable,
  ERC20InitializableInterface,
} from "../ERC20Initializable";

const _abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
    ],
    name: "allowance",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [
      {
        internalType: "uint8",
        name: "",
        type: "uint8",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "subtractedValue",
        type: "uint256",
      },
    ],
    name: "decreaseAllowance",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "addedValue",
        type: "uint256",
      },
    ],
    name: "increaseAllowance",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
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
    inputs: [],
    name: "symbol",
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
    inputs: [],
    name: "totalSupply",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "transfer",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        internalType: "address",
        name: "recipient",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "transferFrom",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const _bytecode =
  "0x608060405234801561001057600080fd5b50610877806100206000396000f3fe608060405234801561001057600080fd5b50600436106100a95760003560e01c80633950935111610071578063395093511461012357806370a082311461013657806395d89b4114610149578063a457c2d714610151578063a9059cbb14610164578063dd62ed3e14610177576100a9565b806306fdde03146100ae578063095ea7b3146100cc57806318160ddd146100ef57806323b872dd14610101578063313ce56714610114575b600080fd5b6100b66101b0565b6040516100c3919061076e565b60405180910390f35b6100df6100da366004610745565b610242565b60405190151581526020016100c3565b6003545b6040519081526020016100c3565b6100df61010f36600461070a565b610258565b604051601281526020016100c3565b6100df610131366004610745565b6102fd565b6100f36101443660046106b7565b610334565b6100b6610353565b6100df61015f366004610745565b610362565b6100df610172366004610745565b6103ef565b6100f36101853660046106d8565b6001600160a01b03918216600090815260026020908152604080832093909416825291909152205490565b6060600480546101bf906107f0565b80601f01602080910402602001604051908101604052809291908181526020018280546101eb906107f0565b80156102385780601f1061020d57610100808354040283529160200191610238565b820191906000526020600020905b81548152906001019060200180831161021b57829003601f168201915b5050505050905090565b600061024f3384846103fc565b50600192915050565b60006102658484846104f9565b6001600160a01b0384166000908152600260209081526040808320338452909152902054828110156102de5760405162461bcd60e51b815260206004820152601d60248201527f53484f59553a20494e53554646494349454e545f414c4c4f57414e434500000060448201526064015b60405180910390fd5b6102f285336102ed86856107d9565b6103fc565b506001949350505050565b3360008181526002602090815260408083206001600160a01b0387168452909152812054909161024f9185906102ed9086906107c1565b6001600160a01b0381166000908152600160205260409020545b919050565b6060600580546101bf906107f0565b3360009081526002602090815260408083206001600160a01b0386168452909152812054828110156103d65760405162461bcd60e51b815260206004820152601a60248201527f53484f59553a20414c4c4f57414e43455f554e444552464c4f5700000000000060448201526064016102d5565b6103e533856102ed86856107d9565b5060019392505050565b600061024f3384846104f9565b6001600160a01b0383166104495760405162461bcd60e51b815260206004820152601460248201527329a427acaa9d1024a72b20a624a22fa7aba722a960611b60448201526064016102d5565b6001600160a01b0382166104985760405162461bcd60e51b815260206004820152601660248201527529a427acaa9d1024a72b20a624a22fa9a822a72222a960511b60448201526064016102d5565b6001600160a01b0383811660008181526002602090815260408083209487168084529482529182902085905590518481527f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925910160405180910390a3505050565b6001600160a01b0383166105475760405162461bcd60e51b815260206004820152601560248201527429a427acaa9d1024a72b20a624a22fa9a2a72222a960591b60448201526064016102d5565b6001600160a01b03821661059d5760405162461bcd60e51b815260206004820152601860248201527f53484f59553a20494e56414c49445f524543495049454e54000000000000000060448201526064016102d5565b6001600160a01b038316600090815260016020526040902054818110156106065760405162461bcd60e51b815260206004820152601b60248201527f53484f59553a20494e53554646494349454e545f42414c414e4345000000000060448201526064016102d5565b61061082826107d9565b6001600160a01b0380861660009081526001602052604080822093909355908516815290812080548492906106469084906107c1565b92505081905550826001600160a01b0316846001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8460405161069291815260200190565b60405180910390a350505050565b80356001600160a01b038116811461034e57600080fd5b6000602082840312156106c8578081fd5b6106d1826106a0565b9392505050565b600080604083850312156106ea578081fd5b6106f3836106a0565b9150610701602084016106a0565b90509250929050565b60008060006060848603121561071e578081fd5b610727846106a0565b9250610735602085016106a0565b9150604084013590509250925092565b60008060408385031215610757578182fd5b610760836106a0565b946020939093013593505050565b6000602080835283518082850152825b8181101561079a5785810183015185820160400152820161077e565b818111156107ab5783604083870101525b50601f01601f1916929092016040019392505050565b600082198211156107d4576107d461082b565b500190565b6000828210156107eb576107eb61082b565b500390565b600181811c9082168061080457607f821691505b6020821081141561082557634e487b7160e01b600052602260045260246000fd5b50919050565b634e487b7160e01b600052601160045260246000fdfea26469706673582212205672f1db136568db7fd4dd30c882434b4ab17415cc9f8668da79d9c6f9e1d21164736f6c63430008030033";

export class ERC20Initializable__factory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer);
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ERC20Initializable> {
    return super.deploy(overrides || {}) as Promise<ERC20Initializable>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): ERC20Initializable {
    return super.attach(address) as ERC20Initializable;
  }
  connect(signer: Signer): ERC20Initializable__factory {
    return super.connect(signer) as ERC20Initializable__factory;
  }
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): ERC20InitializableInterface {
    return new utils.Interface(_abi) as ERC20InitializableInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): ERC20Initializable {
    return new Contract(address, _abi, signerOrProvider) as ERC20Initializable;
  }
}