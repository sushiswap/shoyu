import { ethers, network } from "hardhat";
import { expect } from "chai";

export const getBlock = async (): Promise<number> => {
    return await ethers.provider.getBlockNumber();
};

export const getBlockTimestamp = async (): Promise<number> => {
    return (await ethers.provider.getBlock("latest")).timestamp;
};

export const mine = async (count = 1): Promise<void> => {
    expect(count).to.be.gt(0);
    for (let i = 0; i < count; i++) {
        await ethers.provider.send("evm_mine", []);
    }
};

export const autoMining = async (setting: boolean) => {
    await network.provider.send("evm_setAutomine", [setting]);
};
