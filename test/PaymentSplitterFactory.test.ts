import {
    PaymentSplitterFactory,
    PaymentSplitter
} from "../typechain";

import { domainSeparator, signAsk, signBid } from "./utils/sign-utils";
import { ethers } from "hardhat";
import { expect, assert } from "chai";

const { constants } = ethers;
const { AddressZero } = constants;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR); // turn off warnings

const setupTest = async () => {
    const signers = await ethers.getSigners();
    const [deployer, alice, bob, carol] = signers;

    return {
        deployer,
        alice,
        bob,
        carol,
    };
};

describe("PaymentSplitterFactory", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    it("should be that initial paremeters are set properly", async () => {
        const { alice } = await setupTest();

        const PaymentSplitterFactory = await ethers.getContractFactory("PaymentSplitterFactory");
        const factory = (await PaymentSplitterFactory.deploy()) as PaymentSplitterFactory;
    });
});
