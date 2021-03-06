/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import {
  ethers,
  EventFilter,
  Signer,
  BigNumber,
  BigNumberish,
  PopulatedTransaction,
  BaseContract,
  ContractTransaction,
  CallOverrides,
} from "ethers";
import { BytesLike } from "@ethersproject/bytes";
import { Listener, Provider } from "@ethersproject/providers";
import { FunctionFragment, EventFragment, Result } from "@ethersproject/abi";
import { TypedEventFilter, TypedEvent, TypedListener } from "./commons";

interface DutchAuctionInterface extends ethers.utils.Interface {
  functions: {
    "canBid(address,uint256,bytes,address,uint256,address,uint256,uint256)": FunctionFragment;
    "canClaim(address,uint256,bytes,address,uint256,address,uint256,uint256)": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "canBid",
    values: [
      string,
      BigNumberish,
      BytesLike,
      string,
      BigNumberish,
      string,
      BigNumberish,
      BigNumberish
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "canClaim",
    values: [
      string,
      BigNumberish,
      BytesLike,
      string,
      BigNumberish,
      string,
      BigNumberish,
      BigNumberish
    ]
  ): string;

  decodeFunctionResult(functionFragment: "canBid", data: BytesLike): Result;
  decodeFunctionResult(functionFragment: "canClaim", data: BytesLike): Result;

  events: {};
}

export class DutchAuction extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  listeners<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter?: TypedEventFilter<EventArgsArray, EventArgsObject>
  ): Array<TypedListener<EventArgsArray, EventArgsObject>>;
  off<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  on<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  once<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  removeListener<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  removeAllListeners<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>
  ): this;

  listeners(eventName?: string): Array<Listener>;
  off(eventName: string, listener: Listener): this;
  on(eventName: string, listener: Listener): this;
  once(eventName: string, listener: Listener): this;
  removeListener(eventName: string, listener: Listener): this;
  removeAllListeners(eventName?: string): this;

  queryFilter<EventArgsArray extends Array<any>, EventArgsObject>(
    event: TypedEventFilter<EventArgsArray, EventArgsObject>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEvent<EventArgsArray & EventArgsObject>>>;

  interface: DutchAuctionInterface;

  functions: {
    canBid(
      arg0: string,
      arg1: BigNumberish,
      arg2: BytesLike,
      arg3: string,
      arg4: BigNumberish,
      arg5: string,
      arg6: BigNumberish,
      arg7: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[boolean]>;

    canClaim(
      proxy: string,
      deadline: BigNumberish,
      params: BytesLike,
      arg3: string,
      bidPrice: BigNumberish,
      arg5: string,
      arg6: BigNumberish,
      arg7: BigNumberish,
      overrides?: CallOverrides
    ): Promise<[boolean]>;
  };

  canBid(
    arg0: string,
    arg1: BigNumberish,
    arg2: BytesLike,
    arg3: string,
    arg4: BigNumberish,
    arg5: string,
    arg6: BigNumberish,
    arg7: BigNumberish,
    overrides?: CallOverrides
  ): Promise<boolean>;

  canClaim(
    proxy: string,
    deadline: BigNumberish,
    params: BytesLike,
    arg3: string,
    bidPrice: BigNumberish,
    arg5: string,
    arg6: BigNumberish,
    arg7: BigNumberish,
    overrides?: CallOverrides
  ): Promise<boolean>;

  callStatic: {
    canBid(
      arg0: string,
      arg1: BigNumberish,
      arg2: BytesLike,
      arg3: string,
      arg4: BigNumberish,
      arg5: string,
      arg6: BigNumberish,
      arg7: BigNumberish,
      overrides?: CallOverrides
    ): Promise<boolean>;

    canClaim(
      proxy: string,
      deadline: BigNumberish,
      params: BytesLike,
      arg3: string,
      bidPrice: BigNumberish,
      arg5: string,
      arg6: BigNumberish,
      arg7: BigNumberish,
      overrides?: CallOverrides
    ): Promise<boolean>;
  };

  filters: {};

  estimateGas: {
    canBid(
      arg0: string,
      arg1: BigNumberish,
      arg2: BytesLike,
      arg3: string,
      arg4: BigNumberish,
      arg5: string,
      arg6: BigNumberish,
      arg7: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    canClaim(
      proxy: string,
      deadline: BigNumberish,
      params: BytesLike,
      arg3: string,
      bidPrice: BigNumberish,
      arg5: string,
      arg6: BigNumberish,
      arg7: BigNumberish,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    canBid(
      arg0: string,
      arg1: BigNumberish,
      arg2: BytesLike,
      arg3: string,
      arg4: BigNumberish,
      arg5: string,
      arg6: BigNumberish,
      arg7: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    canClaim(
      proxy: string,
      deadline: BigNumberish,
      params: BytesLike,
      arg3: string,
      bidPrice: BigNumberish,
      arg5: string,
      arg6: BigNumberish,
      arg7: BigNumberish,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}
