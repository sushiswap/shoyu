import {
    TokenFactory,
    NFT1155V0,
    ERC1155Mock,
    ERC20Mock,
    EnglishAuction,
    DutchAuction,
    FixedPriceSale,
    ERC1155ExchangeV0,
    ERC1155RoyaltyMock,
    NFT1155V2,
} from "./typechain";

import { domainSeparator, signAsk, signBid } from "./utils/sign-utils";
import { bid1, bid2 } from "./utils/bid_utils";
import { ethers } from "hardhat";
import { BigNumber, BigNumberish, Wallet, Contract } from "ethers";
import { expect, assert } from "chai";
import { defaultAbiCoder } from "ethers/lib/utils";
import { getBlockTimestamp, mine } from "./utils/blocks";

const { constants } = ethers;
const { AddressZero, HashZero } = constants;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR); // turn off warnings

const setupTest = async () => {
    const signers = await ethers.getSigners();
    const [deployer, protocolVault, operationalVault, alice, bob, carol] = signers;

    const TokenFactoryContract = await ethers.getContractFactory("TokenFactory");
    const factory = (await TokenFactoryContract.deploy(
        protocolVault.address,
        25,
        operationalVault.address,
        5,
        "https://nft721.sushi.com/",
        "https://nft1155.sushi.com/"
    )) as TokenFactory;

    await factory.setDeployerWhitelisted(AddressZero, true);

    const NFT1155Contract = await ethers.getContractFactory("NFT1155V2");
    const nft1155 = (await NFT1155Contract.deploy()) as NFT1155V2;

    const FixedPriceSaleContract = await ethers.getContractFactory("FixedPriceSale");
    const fixedPriceSale = (await FixedPriceSaleContract.deploy()) as FixedPriceSale;
    await factory.setStrategyWhitelisted(fixedPriceSale.address, true);

    const EnglishAuctionContract = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = (await EnglishAuctionContract.deploy()) as EnglishAuction;
    await factory.setStrategyWhitelisted(englishAuction.address, true);

    const DutchAuctionContract = await ethers.getContractFactory("DutchAuction");
    const dutchAuction = (await DutchAuctionContract.deploy()) as DutchAuction;
    await factory.setStrategyWhitelisted(dutchAuction.address, true);

    const ERC1155ExchangeContract = await ethers.getContractFactory("ERC1155ExchangeV0");
    const erc1155Exchange = (await ERC1155ExchangeContract.deploy(factory.address)) as ERC1155ExchangeV0;

    const exchangeName = "ERC1155Exchange";

    const ERC1155MockContract = await ethers.getContractFactory("ERC1155Mock");
    const erc1155Mock0 = (await ERC1155MockContract.deploy()) as ERC1155Mock;
    const erc1155Mock1 = (await ERC1155MockContract.deploy()) as ERC1155Mock;
    const erc1155Mock2 = (await ERC1155MockContract.deploy()) as ERC1155Mock;

    const ERC20MockContract = await ethers.getContractFactory("ERC20Mock");
    const erc20Mock = (await ERC20MockContract.deploy()) as ERC20Mock;

    return {
        deployer,
        protocolVault,
        operationalVault,
        factory,
        erc1155Exchange,
        fixedPriceSale,
        englishAuction,
        dutchAuction,
        alice,
        bob,
        carol,
        erc1155Mock0,
        erc1155Mock1,
        erc1155Mock2,
        erc20Mock,
        exchangeName,
        nft1155,
    };
};

async function getNFT1155(factory: TokenFactory): Promise<NFT1155V2> {
    const events = await factory.queryFilter(factory.filters.DeployNFT1155AndMintBatch(), "latest");
    const NFT1155Contract = await ethers.getContractFactory("NFT1155V2");
    return (await NFT1155Contract.attach(events[0].args[0])) as NFT1155V2;
}

describe("ERC1155Exchange", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });
    function getWallets() {
        const alice = Wallet.fromMnemonic(
            "test test test test test test test test test test test junk",
            "m/44'/60'/0'/0/3"
        ).connect(ethers.provider);
        const bob = Wallet.fromMnemonic(
            "test test test test test test test test test test test junk",
            "m/44'/60'/0'/0/4"
        ).connect(ethers.provider);
        const carol = Wallet.fromMnemonic(
            "test test test test test test test test test test test junk",
            "m/44'/60'/0'/0/5"
        ).connect(ethers.provider);
        const dan = Wallet.fromMnemonic(
            "test test test test test test test test test test test junk",
            "m/44'/60'/0'/0/7"
        ).connect(ethers.provider);
        const erin = Wallet.fromMnemonic(
            "test test test test test test test test test test test junk",
            "m/44'/60'/0'/0/8"
        ).connect(ethers.provider);
        const frank = Wallet.fromMnemonic(
            "test test test test test test test test test test test junk",
            "m/44'/60'/0'/0/9"
        ).connect(ethers.provider);

        const proxy = Wallet.fromMnemonic(
            "test test test test test test test test test test test junk",
            "m/44'/60'/0'/0/10"
        ).connect(ethers.provider);

        return { alice, bob, carol, dan, erin, frank, proxy };
    }
    function fees(price: BigNumberish, protocol: number, operator: number, royalty: number): BigNumberish[] {
        assert.isBelow(protocol, 255);
        assert.isBelow(operator, 255);
        assert.isBelow(royalty, 255);

        const fee: BigNumberish[] = [];

        const p = BigNumber.from(price).mul(protocol).div(1000);
        const o = BigNumber.from(price).mul(operator).div(1000);
        const r = BigNumber.from(price).mul(royalty).div(1000);
        const seller = BigNumber.from(price).sub(p.add(o).add(r));

        fee.push(p);
        fee.push(o);
        fee.push(r);
        fee.push(seller);

        return fee;
    }
    function name(contract: NFT1155V0): string {
        return contract.address.toLowerCase();
    }
    async function checkEvent(contract: Contract, eventName: string, args?: any[]) {
        const events: any = await contract.queryFilter(contract.filters[eventName](), "latest");
        expect(events[0].event).to.be.equal(eventName);

        if (args !== undefined) {
            const length = events[0].args.length;
            expect(length).to.be.gt(0);
            for (let i = 0; i < length; i++) {
                assert.isTrue(args[i] == events[0].args[i]);
            }
        }
    }

    it("should be that initial paremeters are set properly", async () => {
        const { factory, erc1155Exchange } = await setupTest();

        expect(await erc1155Exchange.DOMAIN_SEPARATOR()).to.be.equal(
            await domainSeparator(ethers.provider, "ERC1155Exchange", erc1155Exchange.address)
        );

        expect(await erc1155Exchange.factory()).to.be.equal(factory.address);
    });

    it("should be that the cancel function works well", async () => {
        const { erc1155Exchange, erc1155Mock0, exchangeName, erc20Mock, fixedPriceSale } = await setupTest();

        const { alice, bob } = getWallets();

        await erc1155Mock0.mintBatch(alice.address, [0, 1, 2], [10, 10, 30], []);
        await erc1155Mock0.connect(alice).setApprovalForAll(erc1155Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline0 = currentTime + 100;

        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155Mock0.address,
            0,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            bob,
            AddressZero,
            erc1155Mock0.address,
            1,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );

        await expect(erc1155Exchange.connect(bob).cancel(askOrder0.order)).to.be.revertedWith("SHOYU: FORBIDDEN");

        await expect(erc1155Exchange.connect(alice).cancel(askOrder1.order)).to.be.revertedWith("SHOYU: FORBIDDEN");

        expect(await erc1155Exchange.connect(alice).cancel(askOrder0.order));

        expect(await erc1155Exchange.connect(bob).cancel(askOrder1.order));

        const askOrder2 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155Mock0.address,
            2,
            30,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        await erc20Mock.mint(bob.address, 10000);
        await erc20Mock.connect(bob).approve(erc1155Exchange.address, 10000);

        const fees0 = fees(11 * 50, 25, 5, 0);
        expect(await erc1155Mock0.balanceOf(alice.address, 2)).to.be.equal(30);
        expect(await erc1155Exchange.amountFilled(askOrder2.hash)).to.be.equal(0);
        await expect(() => bid2(erc1155Exchange, bob, askOrder2.order, 11, 50, AddressZero)).to.changeTokenBalances(
            erc20Mock,
            [bob, alice],
            [-550, fees0[3]]
        );
        expect(await erc1155Exchange.amountFilled(askOrder2.hash)).to.be.equal(11);
        expect(await erc1155Mock0.balanceOf(alice.address, 2)).to.be.equal(19);

        await expect(erc1155Exchange.connect(alice).cancel(askOrder2.order)).to.emit(erc1155Exchange, "Cancel");
    });

    it("should be that fees are transfered properly", async () => {
        const {
            factory,
            erc1155Exchange,
            erc1155Mock0,
            erc1155Mock1,
            exchangeName,
            erc20Mock,
            englishAuction,
            fixedPriceSale,
            protocolVault,
            operationalVault,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank, proxy } = getWallets();

        await erc1155Mock0.mintBatch(alice.address, [0, 1, 2, 3], [100, 200, 300, 400], []);
        await erc1155Mock0.connect(alice).setApprovalForAll(erc1155Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.connect(bob).approve(erc1155Exchange.address, 10000000);
        await erc20Mock.connect(carol).approve(erc1155Exchange.address, 10000000);
        await erc20Mock.connect(dan).approve(erc1155Exchange.address, 10000000);
        await erc20Mock.connect(erin).approve(erc1155Exchange.address, 10000000);

        //protocol 25 operator 5 royalty 10
        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155Mock0.address,
            1,
            20,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [12345, currentTime])
        );
        const askOrder2 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            proxy.address,
            erc1155Mock0.address,
            2,
            30,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline - 99,
            defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime])
        );
        const askOrder3 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155Mock0.address,
            3,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [15000, currentTime])
        );

        const fees0 = fees(12345, 25, 5, 0);
        await expect(() => bid2(erc1155Exchange, carol, askOrder1.order, 1, 12345, AddressZero)).to.changeTokenBalances(
            erc20Mock,
            [carol, protocolVault, operationalVault, alice],
            [-12345, fees0[0], fees0[1], fees0[3]]
        );

        await erc20Mock.connect(dan).approve(proxy.address, 10000000);
        const bidOrder2 = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrder2.hash,
            dan,
            3,
            31313,
            dan.address,
            AddressZero
        );
        const fees1 = fees(31313 * 3, 25, 5, 0);
        await expect(bid1(erc1155Exchange, frank, askOrder2.order, bidOrder2.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );
        await expect(() => bid1(erc1155Exchange, proxy, askOrder2.order, bidOrder2.order)).to.changeTokenBalances(
            erc20Mock,
            [dan, protocolVault, operationalVault, alice, frank, proxy],
            [-31313 * 3, fees1[0], fees1[1], fees1[3], 0, 0]
        );

        await factory.setProtocolFeeRecipient(erin.address);
        await factory.setOperationalFeeRecipient(frank.address);
        await factory.setOperationalFee(17);

        //erin 25/1000 frank 17/1000
        const fees2 = fees(15000, 25, 17, 0);
        await expect(() => bid2(erc1155Exchange, dan, askOrder3.order, 1, 15000, AddressZero)).to.changeTokenBalances(
            erc20Mock,
            [dan, erin, frank, alice, protocolVault, operationalVault],
            [-15000, fees2[0], fees2[1], fees2[3], 0, 0, 0]
        );

        await mine(100);
        await erc1155Mock1.mint(alice.address, 0, 10, []);
        await erc1155Mock1.connect(alice).setApprovalForAll(erc1155Exchange.address, true);

        const askOrder4 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155Mock1.address,
            0,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline + 1000,
            defaultAbiCoder.encode(["uint256", "uint256"], [11000, currentTime])
        );

        //erin 25/1000 frank 17/1000
        const fees4 = fees(11000, 25, 17, 0);
        await erc20Mock.connect(dan).approve(erc1155Exchange.address, 10000000);
        await expect(() => bid2(erc1155Exchange, dan, askOrder4.order, 1, 11000, AddressZero)).to.changeTokenBalances(
            erc20Mock,
            [dan, erin, frank, alice, protocolVault, operationalVault],
            [-11000, fees4[0], fees4[1], fees4[3], 0, 0]
        );
    });

    it("should be that NFT1155 tokens can't be traded on ERC1155Exchange but the other ERC1155 tokens can", async () => {
        const {
            factory,
            nft1155,
            erc1155Exchange,
            erc1155Mock0,
            erc1155Mock1,
            erc1155Mock2,
            exchangeName,
            erc20Mock,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol } = getWallets();
        await factory.upgradeNFT1155(nft1155.address);

        await factory.deployNFT1155AndMintBatch(alice.address, [0, 1, 2, 3], [1, 2, 3, 4], carol.address, 10);
        const nft1155_0 = await getNFT1155(factory);

        await factory.deployNFT1155AndMintBatch(alice.address, [0, 1, 2, 3], [9, 8, 7, 6], carol.address, 10);
        const nft1155_1 = await getNFT1155(factory);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.connect(bob).approve(erc1155Exchange.address, 10000000);

        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            nft1155_0.address,
            0,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            nft1155_1.address,
            2,
            2,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );

        assert.isFalse(await erc1155Exchange.canTrade(nft1155_0.address));
        assert.isFalse(await erc1155Exchange.canTrade(nft1155_1.address));

        await expect(bid2(erc1155Exchange, bob, askOrder0.order, 1, 50, AddressZero)).to.be.revertedWith(
            "SHOYU: INVALID_EXCHANGE"
        );
        await expect(bid2(erc1155Exchange, bob, askOrder1.order, 1, 50, AddressZero)).to.be.revertedWith(
            "SHOYU: INVALID_EXCHANGE"
        );

        await erc1155Mock0.mint(bob.address, 3, 1, []);
        await erc1155Mock1.mint(bob.address, 4, 11, []);
        await erc1155Mock2.mint(bob.address, 5, 111, []);
        await erc1155Mock0.connect(bob).setApprovalForAll(erc1155Exchange.address, true);
        await erc1155Mock1.connect(bob).setApprovalForAll(erc1155Exchange.address, true);
        await erc1155Mock2.connect(bob).setApprovalForAll(erc1155Exchange.address, true);

        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.connect(carol).approve(erc1155Exchange.address, 10000000);

        const askOrder3 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            bob,
            AddressZero,
            erc1155Mock0.address,
            3,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        const askOrder4 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            bob,
            AddressZero,
            erc1155Mock1.address,
            4,
            10,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        const askOrder5 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            bob,
            AddressZero,
            erc1155Mock2.address,
            5,
            101,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );

        assert.isTrue(await erc1155Exchange.canTrade(erc1155Mock0.address));
        assert.isTrue(await erc1155Exchange.canTrade(erc1155Mock1.address));
        assert.isTrue(await erc1155Exchange.canTrade(erc1155Mock2.address));

        await bid2(erc1155Exchange, carol, askOrder3.order, 1, 50, AddressZero);
        await checkEvent(erc1155Exchange, "Claim", [askOrder3.hash, carol.address, 1, 50, carol.address, AddressZero]);
        await bid2(erc1155Exchange, carol, askOrder4.order, 7, 50, AddressZero);
        await checkEvent(erc1155Exchange, "Claim", [askOrder4.hash, carol.address, 7, 50, carol.address, AddressZero]);
        await bid2(erc1155Exchange, carol, askOrder5.order, 99, 50, AddressZero);
        await checkEvent(erc1155Exchange, "Claim", [askOrder5.hash, carol.address, 99, 50, carol.address, AddressZero]);
    });

    it("should be that unfullfilled orders can be bidden again but fullfilled orders can't be bidden again", async () => {
        const {
            erc1155Exchange,
            erc1155Mock0,
            exchangeName,
            erc20Mock,
            dutchAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank, proxy } = getWallets();

        await erc1155Mock0.mintBatch(alice.address, [1, 2, 3], [10, 20, 30], []);
        await erc1155Mock0.connect(alice).setApprovalForAll(erc1155Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(bob).approve(erc1155Exchange.address, 10000000);
        await erc20Mock.connect(carol).approve(erc1155Exchange.address, 10000000);
        await erc20Mock.connect(dan).approve(erc1155Exchange.address, 10000000);
        await erc20Mock.connect(erin).approve(erc1155Exchange.address, 10000000);
        await erc20Mock.connect(frank).approve(erc1155Exchange.address, 10000000);

        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155Mock0.address,
            1,
            10,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentTime])
        );
        const askOrder2 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155Mock0.address,
            2,
            10,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime])
        );
        const askOrder3 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            proxy.address,
            erc1155Mock0.address,
            3,
            10,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime])
        );

        await bid2(erc1155Exchange, carol, askOrder1.order, 9, 999, AddressZero);
        await checkEvent(erc1155Exchange, "Claim", [askOrder1.hash, carol.address, 9, 999, carol.address, AddressZero]);

        await bid2(erc1155Exchange, dan, askOrder2.order, 9, 100, AddressZero);
        await checkEvent(erc1155Exchange, "Claim", [askOrder2.hash, dan.address, 9, 100, dan.address, AddressZero]);

        await erc20Mock.connect(dan).approve(proxy.address, 10000);
        const bidOrder3 = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrder3.hash,
            dan,
            9,
            100,
            dan.address,
            AddressZero
        );
        await bid1(erc1155Exchange, proxy, askOrder3.order, bidOrder3.order);
        await checkEvent(erc1155Exchange, "Claim", [askOrder3.hash, dan.address, 9, 100, dan.address, AddressZero]);

        await expect(bid2(erc1155Exchange, carol, askOrder1.order, 9, 999, AddressZero)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );
        await expect(bid2(erc1155Exchange, dan, askOrder2.order, 9, 100, AddressZero)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );

        await bid2(erc1155Exchange, carol, askOrder1.order, 1, 990, AddressZero);
        await checkEvent(erc1155Exchange, "Claim", [askOrder1.hash, carol.address, 1, 990, carol.address, AddressZero]);

        await bid2(erc1155Exchange, dan, askOrder2.order, 1, 100, AddressZero);
        await checkEvent(erc1155Exchange, "Claim", [askOrder2.hash, dan.address, 1, 100, dan.address, AddressZero]);

        await expect(bid1(erc1155Exchange, proxy, askOrder3.order, bidOrder3.order)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );

        await erc1155Mock0.connect(carol).safeTransferFrom(carol.address, alice.address, 1, 9, []);
        await expect(bid2(erc1155Exchange, carol, askOrder1.order, 9, 999, AddressZero)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );

        const bidOrder3_ = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrder3.hash,
            dan,
            1,
            100,
            dan.address,
            AddressZero
        );
        await bid1(erc1155Exchange, proxy, askOrder3.order, bidOrder3_.order);
        await checkEvent(erc1155Exchange, "Claim", [askOrder3.hash, dan.address, 1, 100, dan.address, AddressZero]);
    });

    it("should be that bid(Orders.Ask memory askOrder, Orders.Bid memory bidOrder) function works well", async () => {
        const {
            erc1155Exchange,
            erc1155Mock0,
            exchangeName,
            erc20Mock,
            dutchAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol, dan, frank } = getWallets();

        await erc1155Mock0.mintBatch(
            alice.address,
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
            []
        );
        await erc1155Mock0.connect(alice).setApprovalForAll(erc1155Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.connect(carol).approve(erc1155Exchange.address, 10000000);
        await erc20Mock.connect(dan).approve(erc1155Exchange.address, 10000000);

        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155Mock0.address,
            1,
            5,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentTime])
        );
        const askOrder2 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155Mock0.address,
            2,
            3,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime])
        );

        const bidOrder1 = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrder1.hash,
            carol,
            4,
            990,
            AddressZero,
            AddressZero
        );
        const bidOrder2 = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrder2.hash,
            dan,
            3,
            100,
            AddressZero,
            AddressZero
        );

        await bid1(erc1155Exchange, frank, askOrder1.order, bidOrder1.order);
        await checkEvent(erc1155Exchange, "Claim", [askOrder1.hash, carol.address, 4, 990, carol.address, AddressZero]);
        await bid1(erc1155Exchange, bob, askOrder2.order, bidOrder2.order);
        await checkEvent(erc1155Exchange, "Claim", [askOrder2.hash, dan.address, 3, 100, dan.address, AddressZero]);
    });

    it("should be that fees and nft go to recipients if they are set in orders", async () => {
        const {
            operationalVault,
            protocolVault,
            erc1155Exchange,
            erc1155Mock0,
            exchangeName,
            erc20Mock,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol, dan, frank } = getWallets();

        await erc1155Mock0.mintBatch(alice.address, [0, 1], [10, 11], []);
        await erc1155Mock0.connect(alice).setApprovalForAll(erc1155Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.connect(bob).approve(erc1155Exchange.address, 10000000);
        await erc20Mock.connect(carol).approve(erc1155Exchange.address, 10000000);
        await erc20Mock.connect(dan).approve(erc1155Exchange.address, 10000000);

        //protocol 25 operator 5 royalty 10
        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155Mock0.address,
            1,
            5,
            fixedPriceSale.address,
            erc20Mock.address,
            frank.address,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [12345, currentTime])
        );

        const fees0 = fees(12345 * 3, 25, 5, 0);
        await expect(() => bid2(erc1155Exchange, carol, askOrder1.order, 3, 12345, bob.address)).to.changeTokenBalances(
            erc20Mock,
            [carol, protocolVault, operationalVault, frank, alice],
            [-12345 * 3, fees0[0], fees0[1], fees0[3], 0]
        );
        expect(await erc1155Mock0.balanceOf(carol.address, 1)).to.be.equal(0);
        expect(await erc1155Mock0.balanceOf(bob.address, 1)).to.be.equal(3);
    });

    it("should be that token implementing EIP2981 give royalty to recipient when auction is finished", async () => {
        const {
            deployer,
            operationalVault,
            protocolVault,
            erc1155Exchange,
            exchangeName,
            erc20Mock,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol } = getWallets();

        const ERC1155RoyaltyMockContract = await ethers.getContractFactory("ERC1155RoyaltyMock");
        const erc1155RoyaltyMock0 = (await ERC1155RoyaltyMockContract.deploy()) as ERC1155RoyaltyMock;

        await erc1155RoyaltyMock0.mintBatch(alice.address, [8, 25], [22, 55], []);
        await erc1155RoyaltyMock0.connect(alice).setApprovalForAll(erc1155Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.connect(bob).approve(erc1155Exchange.address, 10000000);
        await erc20Mock.connect(carol).approve(erc1155Exchange.address, 10000000);

        expect((await erc1155RoyaltyMock0.royaltyInfo(8, 1000))[0]).to.be.equal(deployer.address);
        expect((await erc1155RoyaltyMock0.royaltyInfo(8, 1000))[1]).to.be.equal(10);
        expect((await erc1155RoyaltyMock0.royaltyInfo(25, 1000))[0]).to.be.equal(deployer.address);
        expect((await erc1155RoyaltyMock0.royaltyInfo(25, 1000))[1]).to.be.equal(100);

        //protocol 25 operator 5 royalty 10
        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155RoyaltyMock0.address,
            8,
            20,
            fixedPriceSale.address,
            erc20Mock.address,
            alice.address,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [12345, currentTime])
        );

        const fees0 = fees(12345 * 15, 25, 5, 10);
        await expect(() =>
            bid2(erc1155Exchange, carol, askOrder0.order, 15, 12345, carol.address)
        ).to.changeTokenBalances(
            erc20Mock,
            [carol, protocolVault, operationalVault, deployer, alice],
            [-12345 * 15, fees0[0], fees0[1], fees0[2], fees0[3]]
        );
        expect(await erc1155RoyaltyMock0.balanceOf(carol.address, 8)).to.be.equal(15);

        //protocol 25 operator 5 royalty 100
        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155RoyaltyMock0.address,
            25,
            44,
            fixedPriceSale.address,
            erc20Mock.address,
            alice.address,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [54321, currentTime])
        );

        const fees1 = fees(54321 * 44, 25, 5, 100);
        await expect(() => bid2(erc1155Exchange, bob, askOrder1.order, 44, 54321, bob.address)).to.changeTokenBalances(
            erc20Mock,
            [bob, protocolVault, operationalVault, deployer, alice],
            [-54321 * 44, fees1[0], fees1[1], fees1[2], fees1[3]]
        );
        expect(await erc1155RoyaltyMock0.balanceOf(bob.address, 25)).to.be.equal(44);
    });

    it("should be that bid and claim functions work properly with proxy", async () => {
        const {
            erc1155Exchange,
            erc1155Mock0,
            exchangeName,
            erc20Mock,
            dutchAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, dan, erin, frank, proxy } = getWallets();

        await erc1155Mock0.mintBatch(
            alice.address,
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
            []
        );
        await erc1155Mock0.connect(alice).setApprovalForAll(erc1155Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(dan).approve(erc1155Exchange.address, 10000000);
        await erc20Mock.connect(erin).approve(erc1155Exchange.address, 10000000);
        await erc20Mock.connect(frank).approve(erc1155Exchange.address, 10000000);

        const askOrderFwithP = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            proxy.address,
            erc1155Mock0.address,
            2,
            10,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [200, currentTime])
        );
        const askOrderFwithoutP = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155Mock0.address,
            3,
            10,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [201, currentTime])
        );

        const askOrderDwithP = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            proxy.address,
            erc1155Mock0.address,
            4,
            10,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentTime])
        );
        const askOrderDwithoutP = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155Mock0.address,
            5,
            10,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentTime])
        );

        const bidOrderFwithP = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrderFwithP.hash,
            erin,
            3,
            200,
            AddressZero,
            AddressZero
        );
        const bidOrderFwithoutP = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrderFwithoutP.hash,
            erin,
            4,
            201,
            AddressZero,
            AddressZero
        );

        await expect(bid1(erc1155Exchange, bob, askOrderFwithP.order, bidOrderFwithP.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );
        await bid1(erc1155Exchange, proxy, askOrderFwithP.order, bidOrderFwithP.order);
        await checkEvent(erc1155Exchange, "Claim", [
            askOrderFwithP.hash,
            erin.address,
            3,
            200,
            erin.address,
            AddressZero,
        ]);

        await bid1(erc1155Exchange, bob, askOrderFwithoutP.order, bidOrderFwithoutP.order);
        await checkEvent(erc1155Exchange, "Claim", [
            askOrderFwithoutP.hash,
            erin.address,
            4,
            201,
            erin.address,
            AddressZero,
        ]);
        expect(await erc1155Mock0.balanceOf(erin.address, 2)).to.be.equal(3);
        expect(await erc1155Mock0.balanceOf(erin.address, 3)).to.be.equal(4);

        const bidOrderDwithP = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrderDwithP.hash,
            frank,
            2,
            990,
            AddressZero,
            AddressZero
        );
        const bidOrderDwithoutP = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrderDwithoutP.hash,
            frank,
            3,
            980,
            AddressZero,
            AddressZero
        );

        await expect(bid1(erc1155Exchange, bob, askOrderDwithP.order, bidOrderDwithP.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );
        await bid1(erc1155Exchange, proxy, askOrderDwithP.order, bidOrderDwithP.order);
        await checkEvent(erc1155Exchange, "Claim", [
            askOrderDwithP.hash,
            frank.address,
            2,
            990,
            frank.address,
            AddressZero,
        ]);

        await bid1(erc1155Exchange, bob, askOrderDwithoutP.order, bidOrderDwithoutP.order);
        await checkEvent(erc1155Exchange, "Claim", [
            askOrderDwithoutP.hash,
            frank.address,
            3,
            980,
            frank.address,
            AddressZero,
        ]);
        expect(await erc1155Mock0.balanceOf(frank.address, 4)).to.be.equal(2);
        expect(await erc1155Mock0.balanceOf(frank.address, 5)).to.be.equal(3);

        const askOrderFwithP1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            proxy.address,
            erc1155Mock0.address,
            6,
            10,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [200, currentTime])
        );
        const askOrderFwithoutP1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155Mock0.address,
            7,
            10,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [201, currentTime])
        );

        const askOrderDwithP1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            proxy.address,
            erc1155Mock0.address,
            8,
            10,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentTime])
        );
        const askOrderDwithoutP1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            AddressZero,
            erc1155Mock0.address,
            9,
            10,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentTime])
        );

        await mine(100);
        expect(await getBlockTimestamp()).gt(deadline);
        const bidOrderFwithP1 = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrderFwithP1.hash,
            erin,
            3,
            200,
            AddressZero,
            AddressZero
        );
        const bidOrderFwithoutP1 = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrderFwithoutP1.hash,
            erin,
            4,
            201,
            AddressZero,
            AddressZero
        );

        await bid1(erc1155Exchange, proxy, askOrderFwithP1.order, bidOrderFwithP1.order);
        await checkEvent(erc1155Exchange, "Claim", [
            askOrderFwithP1.hash,
            erin.address,
            3,
            200,
            erin.address,
            AddressZero,
        ]);
        await expect(bid1(erc1155Exchange, bob, askOrderFwithoutP1.order, bidOrderFwithoutP1.order)).to.be.revertedWith(
            "SHOYU: FAILURE"
        );

        const bidOrderDwithP1 = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrderDwithP1.hash,
            frank,
            5,
            990,
            AddressZero,
            AddressZero
        );
        const bidOrderDwithoutP1 = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrderDwithoutP1.hash,
            frank,
            6,
            980,
            AddressZero,
            AddressZero
        );

        await bid1(erc1155Exchange, proxy, askOrderDwithP1.order, bidOrderDwithP1.order);
        await checkEvent(erc1155Exchange, "Claim", [
            askOrderDwithP1.hash,
            frank.address,
            5,
            990,
            frank.address,
            AddressZero,
        ]);
        await expect(bid1(erc1155Exchange, bob, askOrderDwithoutP1.order, bidOrderDwithoutP1.order)).to.be.revertedWith(
            "SHOYU: FAILURE"
        );
    });

    it("should be that bid and claim functions work properly with _bidHashes", async () => {
        const {
            erc1155Exchange,
            erc1155Mock0,
            exchangeName,
            erc20Mock,
            dutchAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, carol, dan, erin, frank, proxy } = getWallets();

        await erc1155Mock0.mintBatch(
            alice.address,
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
            []
        );
        await erc1155Mock0.connect(alice).setApprovalForAll(erc1155Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(dan).approve(erc1155Exchange.address, 10000000);
        await erc20Mock.connect(erin).approve(erc1155Exchange.address, 10000000);
        await erc20Mock.connect(frank).approve(erc1155Exchange.address, 10000000);

        const askOrderF0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            proxy.address,
            erc1155Mock0.address,
            2,
            10,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [200, currentTime])
        );
        const askOrderF1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            proxy.address,
            erc1155Mock0.address,
            3,
            10,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [201, currentTime])
        );
        const askOrderD0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            alice,
            proxy.address,
            erc1155Mock0.address,
            4,
            10,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentTime])
        );

        const bidOrderF0 = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrderF0.hash,
            erin,
            3,
            200,
            AddressZero,
            AddressZero
        );
        const bidOrderF1 = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrderF1.hash,
            erin,
            4,
            201,
            AddressZero,
            AddressZero
        );

        expect(await erc1155Exchange.approvedBidHash(proxy.address, askOrderF0.hash, erin.address)).to.be.equal(
            HashZero
        );
        await expect(
            erc1155Exchange.connect(proxy).updateApprovedBidHash(askOrderF0.hash, erin.address, bidOrderF0.hash)
        )
            .to.emit(erc1155Exchange, "UpdateApprovedBidHash")
            .withArgs(proxy.address, askOrderF0.hash, erin.address, bidOrderF0.hash);
        expect(await erc1155Exchange.approvedBidHash(proxy.address, askOrderF0.hash, erin.address)).to.be.equal(
            bidOrderF0.hash
        );

        await expect(
            bid2(
                erc1155Exchange,
                erin,
                askOrderF0.order,
                bidOrderF0.order.amount,
                bidOrderF0.order.price,
                bidOrderF0.order.recipient
            )
        ).to.be.revertedWith("SHOYU: FORBIDDEN");

        await expect(erc1155Exchange.connect(carol).claim(askOrderF0.order)).to.be.revertedWith("SHOYU: FAILURE");
        await bid1(erc1155Exchange, frank, askOrderF0.order, bidOrderF0.order); //frank can call
        await checkEvent(erc1155Exchange, "Claim", [askOrderF0.hash, erin.address, 3, 200, erin.address, AddressZero]);
        expect(await erc1155Exchange.approvedBidHash(proxy.address, askOrderF0.hash, erin.address)).to.be.equal(
            HashZero
        );

        const bidOrderF1_ = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrderF1.hash,
            erin,
            9,
            201,
            AddressZero,
            AddressZero
        );
        await erc1155Exchange.connect(erin).updateApprovedBidHash(askOrderF1.hash, erin.address, bidOrderF1_.hash); //make fake hash for abusing
        expect(await erc1155Exchange.approvedBidHash(erin.address, askOrderF1.hash, erin.address)).to.be.equal(
            bidOrderF1_.hash
        );
        expect(await erc1155Exchange.approvedBidHash(proxy.address, askOrderF1.hash, erin.address)).to.be.equal(
            HashZero
        );
        await expect(bid1(erc1155Exchange, erin, askOrderF1.order, bidOrderF1_.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );

        await mine(100);
        expect(await getBlockTimestamp()).to.be.gt(askOrderF1.order.deadline);
        await erc1155Exchange.connect(proxy).updateApprovedBidHash(askOrderF1.hash, erin.address, bidOrderF1.hash); //timeover but update available
        expect(await erc1155Exchange.approvedBidHash(proxy.address, askOrderF1.hash, erin.address)).to.be.equal(
            bidOrderF1.hash
        );

        const bidOrderF1__ = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrderF1.hash,
            erin,
            3,
            201,
            AddressZero,
            AddressZero
        ); //change conditions after hash approved
        await expect(bid1(erc1155Exchange, erin, askOrderF1.order, bidOrderF1__.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );

        await bid1(erc1155Exchange, erin, askOrderF1.order, bidOrderF1.order);
        await checkEvent(erc1155Exchange, "Claim", [askOrderF1.hash, erin.address, 4, 201, erin.address, AddressZero]);
        expect(await erc1155Exchange.approvedBidHash(proxy.address, askOrderF1.hash, erin.address)).to.be.equal(
            HashZero
        );
        expect(await erc1155Mock0.balanceOf(erin.address, 2)).to.be.equal(3);
        expect(await erc1155Mock0.balanceOf(erin.address, 3)).to.be.equal(4);

        const bidOrderD0 = await signBid(
            ethers.provider,
            exchangeName,
            erc1155Exchange.address,
            askOrderD0.hash,
            frank,
            2,
            990,
            AddressZero,
            AddressZero
        );

        expect(await getBlockTimestamp()).to.be.gt(askOrderD0.order.deadline);
        await erc1155Exchange.connect(proxy).updateApprovedBidHash(askOrderD0.hash, frank.address, bidOrderD0.hash); //timeover but update available
        expect(await erc1155Exchange.approvedBidHash(proxy.address, askOrderD0.hash, frank.address)).to.be.equal(
            bidOrderD0.hash
        );

        await bid1(erc1155Exchange, frank, askOrderD0.order, bidOrderD0.order);
        await checkEvent(erc1155Exchange, "Claim", [
            askOrderD0.hash,
            frank.address,
            2,
            990,
            frank.address,
            AddressZero,
        ]);
        expect(await erc1155Exchange.approvedBidHash(proxy.address, askOrderD0.hash, frank.address)).to.be.equal(
            HashZero
        );
        expect(await erc1155Mock0.balanceOf(frank.address, 4)).to.be.equal(2);
    });
});
