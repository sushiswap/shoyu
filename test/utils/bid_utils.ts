import { ethers, BigNumberish, Wallet, Contract } from "ethers";
import { AskOrder, BidOrder } from "./sign-utils";

export async function bid1(exchange: Contract, txSigner: Wallet, askOrder: AskOrder, bidOrder: BidOrder) {
    await exchange
        .connect(txSigner)
        [
            "bid((address,address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),(bytes32,address,uint256,uint256,address,address,uint8,bytes32,bytes32))"
        ](askOrder, bidOrder);
}

export async function bid2(
    exchange: Contract,
    txSigner: Wallet,
    askOrder: AskOrder,
    bidAmount: BigNumberish,
    bidPrice: BigNumberish,
    bidRecipient: string
) {
    await exchange
        .connect(txSigner)
        [
            "bid((address,address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
        ](askOrder, bidAmount, bidPrice, bidRecipient, ethers.constants.AddressZero);
}
