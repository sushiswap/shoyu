import { PaymentSplitterFactory, PaymentSplitter } from "../typechain";

import { domainSeparator, signAsk, signBid } from "./utils/sign-utils";
import { ethers } from "hardhat";
import { expect, assert } from "chai";

const { constants } = ethers;
const { AddressZero } = constants;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR); // turn off warnings

const setupTest = async () => {
    const signers = await ethers.getSigners();
    const [deployer, alice, bob, carol] = signers;

    const PaymentSplitterFactory = await ethers.getContractFactory("PaymentSplitterFactory");
    const factory = (await PaymentSplitterFactory.deploy()) as PaymentSplitterFactory;

    const PaymentSplitter = await ethers.getContractFactory("PaymentSplitter");

    return {
        factory,
        PaymentSplitter,
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
        const { alice, bob, carol, factory, PaymentSplitter } = await setupTest();

        await factory.deployPaymentSplitter(
            alice.address,
            "TestSplitter",
            [alice.address, bob.address, carol.address],
            [10, 50, 20]
        );

        let events = await factory.queryFilter(factory.filters.DeployPaymentSplitter(), "latest");
        const splitter = (await PaymentSplitter.attach(events[0].args[4] as string)) as PaymentSplitter;

        expect(await splitter.title()).to.be.equal("TestSplitter");
        expect(await splitter.totalShares()).to.be.equal(10 + 50 + 20);
        expect(await splitter.payees(0)).to.be.equal(alice.address);
        expect(await splitter.payees(1)).to.be.equal(bob.address);
        expect(await splitter.payees(2)).to.be.equal(carol.address);
        expect(await splitter.shares(alice.address)).to.be.equal(10);
        expect(await splitter.shares(bob.address)).to.be.equal(50);
        expect(await splitter.shares(carol.address)).to.be.equal(20);
    });
});
