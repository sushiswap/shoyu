import { PaymentSplitterFactory, PaymentSplitter, ERC20Mock } from "../typechain";

import { ethers } from "hardhat";
import { expect } from "chai";

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR); // turn off warnings

const setupTest = async () => {
    const signers = await ethers.getSigners();
    const [deployer, alice, bob, carol] = signers;

    const PaymentSplitterFactory = await ethers.getContractFactory("PaymentSplitterFactory");
    const factory = (await PaymentSplitterFactory.deploy()) as PaymentSplitterFactory;

    const ERC20MockContract = await ethers.getContractFactory("ERC20Mock");
    const erc20Mock = (await ERC20MockContract.deploy()) as ERC20Mock;
    const erc20Mock2 = (await ERC20MockContract.deploy()) as ERC20Mock;

    return {
        factory,
        erc20Mock,
        erc20Mock2,
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

    async function getSplitter(factory: PaymentSplitterFactory): Promise<PaymentSplitter> {
        const PaymentSplitter = await ethers.getContractFactory("PaymentSplitter");
        const events = await factory.queryFilter(factory.filters.DeployPaymentSplitter(), "latest");
        return (await PaymentSplitter.attach(events[0].args[4] as string)) as PaymentSplitter;
    }

    it("should be that the algorithm works well", async () => {
        const { alice, bob, carol, factory, erc20Mock, erc20Mock2 } = await setupTest();

        await factory.deployPaymentSplitter(
            alice.address,
            "TestSplitter",
            [alice.address, bob.address, carol.address],
            [1, 2, 3]
        );
        const splitter0 = await getSplitter(factory);

        await erc20Mock.mint(splitter0.address, 600);

        await expect(() => splitter0.release(erc20Mock.address, alice.address)).to.changeTokenBalance(
            erc20Mock,
            alice,
            100
        );
        await expect(() => splitter0.release(erc20Mock.address, bob.address)).to.changeTokenBalance(
            erc20Mock,
            bob,
            200
        );
        await expect(() => splitter0.release(erc20Mock.address, carol.address)).to.changeTokenBalance(
            erc20Mock,
            carol,
            300
        );
        await expect(splitter0.release(erc20Mock.address, carol.address)).to.be.revertedWith("SHOYU: NO_PAYMENT");
        await expect(splitter0.release(erc20Mock.address, factory.address)).to.be.revertedWith("SHOYU: FORBIDDEN");

        await factory.deployPaymentSplitter(
            alice.address,
            "TestSplitter",
            [alice.address, bob.address, carol.address],
            [1, 2, 3]
        );
        const splitter1 = await getSplitter(factory);

        await erc20Mock.mint(splitter1.address, 600);

        await expect(() => splitter1.release(erc20Mock.address, alice.address)).to.changeTokenBalance(
            erc20Mock,
            alice,
            100
        );
        await erc20Mock.mint(splitter1.address, 600);
        await expect(() => splitter1.release(erc20Mock.address, bob.address)).to.changeTokenBalance(
            erc20Mock,
            bob,
            400
        );
        await erc20Mock.mint(splitter1.address, 600);
        await expect(() => splitter1.release(erc20Mock.address, carol.address)).to.changeTokenBalance(
            erc20Mock,
            carol,
            900
        );

        await erc20Mock2.mint(splitter1.address, 600);
        await expect(() => splitter1.release(erc20Mock.address, alice.address)).to.changeTokenBalance(
            erc20Mock,
            alice,
            200
        );
        await expect(() => splitter1.release(erc20Mock2.address, alice.address)).to.changeTokenBalance(
            erc20Mock2,
            alice,
            100
        );
    });
});
