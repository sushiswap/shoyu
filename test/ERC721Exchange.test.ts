import {
    TokenFactory,
    ERC721Mock,
    ERC20Mock,
    EnglishAuction,
    DutchAuction,
    FixedPriceSale,
    ERC721ExchangeV0,
    ERC721RoyaltyMock,
    NFT721V1,
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

    const NFT721Contract = await ethers.getContractFactory("NFT721V1");
    const nft721 = (await NFT721Contract.deploy()) as NFT721V1;

    const FixedPriceSaleContract = await ethers.getContractFactory("FixedPriceSale");
    const fixedPriceSale = (await FixedPriceSaleContract.deploy()) as FixedPriceSale;
    await factory.setStrategyWhitelisted(fixedPriceSale.address, true);

    const EnglishAuctionContract = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = (await EnglishAuctionContract.deploy()) as EnglishAuction;
    await factory.setStrategyWhitelisted(englishAuction.address, true);

    const DutchAuctionContract = await ethers.getContractFactory("DutchAuction");
    const dutchAuction = (await DutchAuctionContract.deploy()) as DutchAuction;
    await factory.setStrategyWhitelisted(dutchAuction.address, true);

    const ERC721ExchangeContract = await ethers.getContractFactory("ERC721ExchangeV0");
    const erc721Exchange = (await ERC721ExchangeContract.deploy(factory.address)) as ERC721ExchangeV0;

    const exchangeName = "ERC721Exchange";

    const ERC721MockContract = await ethers.getContractFactory("ERC721Mock");
    const erc721Mock0 = (await ERC721MockContract.deploy()) as ERC721Mock;
    const erc721Mock1 = (await ERC721MockContract.deploy()) as ERC721Mock;
    const erc721Mock2 = (await ERC721MockContract.deploy()) as ERC721Mock;

    const ERC20MockContract = await ethers.getContractFactory("ERC20Mock");
    const erc20Mock = (await ERC20MockContract.deploy()) as ERC20Mock;

    return {
        deployer,
        protocolVault,
        operationalVault,
        factory,
        erc721Exchange,
        fixedPriceSale,
        englishAuction,
        dutchAuction,
        alice,
        bob,
        carol,
        erc721Mock0,
        erc721Mock1,
        erc721Mock2,
        erc20Mock,
        exchangeName,
        nft721,
    };
};

async function getNFT721(factory: TokenFactory): Promise<NFT721V1> {
    let events: any = await factory.queryFilter(factory.filters.DeployNFT721AndMintBatch(), "latest");
    if (events.length == 0) events = await factory.queryFilter(factory.filters.DeployNFT721AndPark(), "latest");
    const NFT721Contract = await ethers.getContractFactory("NFT721V1");
    return (await NFT721Contract.attach(events[0].args[0])) as NFT721V1;
}

describe("ERC721Exchange", () => {
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
        const { factory, erc721Exchange } = await setupTest();

        expect(await erc721Exchange.DOMAIN_SEPARATOR()).to.be.equal(
            await domainSeparator(ethers.provider, "ERC721Exchange", erc721Exchange.address)
        );

        expect(await erc721Exchange.factory()).to.be.equal(factory.address);
    });

    it("should be that the cancel function works well", async () => {
        const { erc721Exchange, erc721Mock0, exchangeName, erc20Mock, englishAuction } = await setupTest();

        const { alice, bob, carol } = getWallets();

        await erc721Mock0.safeMint(alice.address, 0, []);
        await erc721Mock0.safeMint(bob.address, 1, []);
        await erc721Mock0.safeMint(carol.address, 2, []);

        const currentTime = await getBlockTimestamp();
        const deadline0 = currentTime + 100;
        expect(await erc721Mock0.ownerOf(0)).to.be.equal(alice.address);
        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            bob,
            AddressZero,
            erc721Mock0.address,
            1,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256"], [50])
        );

        await expect(erc721Exchange.connect(bob).cancel(askOrder0.order)).to.be.revertedWith("SHOYU: FORBIDDEN");

        await expect(erc721Exchange.connect(alice).cancel(askOrder1.order)).to.be.revertedWith("SHOYU: FORBIDDEN");

        expect(await erc721Exchange.connect(alice).cancel(askOrder0.order));

        expect(await erc721Exchange.connect(bob).cancel(askOrder1.order));

        const askOrder2 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            carol,
            AddressZero,
            erc721Mock0.address,
            2,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256"], [50])
        );

        expect((await erc721Exchange.bestBid(askOrder2.hash))[0]).to.be.equal(AddressZero);
        await bid2(erc721Exchange, bob, askOrder2.order, 1, 100, AddressZero);
        await checkEvent(erc721Exchange, "Bid", [askOrder2.hash, bob.address, 1, 100, AddressZero, AddressZero]);
        expect((await erc721Exchange.bestBid(askOrder2.hash))[0]).to.be.equal(bob.address);

        await expect(erc721Exchange.connect(carol).cancel(askOrder2.order)).to.be.revertedWith("SHOYU: BID_EXISTS");
    });

    it("should be that the claim function can be called by anyone", async () => {
        const { erc721Exchange, erc721Mock0, exchangeName, erc20Mock, englishAuction } = await setupTest();

        const { alice, bob, carol, dan } = getWallets();

        await erc721Mock0.safeMintBatch0([alice.address, bob.address, alice.address], [0, 1, 2], []);
        await erc721Mock0.connect(alice).setApprovalForAll(erc721Exchange.address, true);
        await erc721Mock0.connect(bob).setApprovalForAll(erc721Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline0 = currentTime + 100;
        expect(await erc721Mock0.ownerOf(0)).to.be.equal(alice.address);

        await erc20Mock.mint(carol.address, 10000);
        await erc20Mock.mint(dan.address, 10000);
        await erc20Mock.connect(carol).approve(erc721Exchange.address, 10000);
        await erc20Mock.connect(dan).approve(erc721Exchange.address, 10000);

        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            bob,
            AddressZero,
            erc721Mock0.address,
            1,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrder2 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            2,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256"], [50])
        );

        await bid2(erc721Exchange, carol, askOrder0.order, 1, 100, AddressZero);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[0]).to.be.equal(carol.address);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[2]).to.be.equal(100);

        await bid2(erc721Exchange, dan, askOrder1.order, 1, 300, AddressZero);
        expect((await erc721Exchange.bestBid(askOrder1.hash))[0]).to.be.equal(dan.address);
        expect((await erc721Exchange.bestBid(askOrder1.hash))[2]).to.be.equal(300);

        await bid2(erc721Exchange, dan, askOrder2.order, 1, 500, AddressZero);
        expect((await erc721Exchange.bestBid(askOrder2.hash))[0]).to.be.equal(dan.address);
        expect((await erc721Exchange.bestBid(askOrder2.hash))[2]).to.be.equal(500);

        await mine(100);
        assert.isTrue(deadline0 < (await getBlockTimestamp()));

        //nft0 : seller-Alice / buyer-Carol. Dan can claim.
        expect(await erc721Exchange.connect(dan).claim(askOrder0.order)).to.emit(erc721Exchange, "Claim");
        expect(await erc721Mock0.ownerOf(0)).to.be.equal(carol.address);
        expect(await erc20Mock.balanceOf(carol.address)).to.be.equal(9900);

        //nft1 : seller-Bob / buyer-Dan.  Seller Bob can claim.
        expect(await erc721Exchange.connect(bob).claim(askOrder1.order)).to.emit(erc721Exchange, "Claim");
        expect(await erc721Mock0.ownerOf(1)).to.be.equal(dan.address);
        expect(await erc20Mock.balanceOf(dan.address)).to.be.equal(9700);

        //nft2 : seller-Alice / buyer-Dan.  Buyer Dan can claim.
        expect(await erc721Exchange.connect(dan).claim(askOrder2.order)).to.emit(erc721Exchange, "Claim");
        expect((await erc721Exchange.bestBid(askOrder2.hash))[0]).to.be.equal(AddressZero);
        expect(await erc721Mock0.ownerOf(2)).to.be.equal(dan.address);
        expect(await erc20Mock.balanceOf(dan.address)).to.be.equal(9200);
    });

    it("should be that the claim function will be reverted if BestBid is not exist", async () => {
        const {
            erc721Exchange,
            erc721Mock0,
            exchangeName,
            erc20Mock,
            englishAuction,
            dutchAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, proxy } = getWallets();

        await erc721Mock0.safeMintBatch1(alice.address, [0, 1, 2, 3], []);
        await erc721Mock0.connect(alice).setApprovalForAll(erc721Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline0 = currentTime + 100;
        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            1,
            1,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentTime])
        );
        const askOrder2 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            2,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256"], [100])
        );
        const askOrder3 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            proxy.address,
            erc721Mock0.address,
            3,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256"], [100])
        );

        expect((await erc721Exchange.bestBid(askOrder0.hash))[0]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder1.hash))[0]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder2.hash))[0]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder3.hash))[0]).to.be.equal(AddressZero);

        await expect(erc721Exchange.claim(askOrder3.order)).to.be.revertedWith("SHOYU: FAILURE");

        await expect(erc721Exchange.claim(askOrder2.order)).to.be.revertedWith("SHOYU: FAILURE");

        await expect(erc721Exchange.claim(askOrder1.order)).to.be.revertedWith("SHOYU: FAILURE");

        await expect(erc721Exchange.claim(askOrder0.order)).to.be.revertedWith("SHOYU: FAILURE");
        assert.isFalse(deadline0 < (await getBlockTimestamp()));
        assert.isFalse(await erc721Exchange.isCancelledOrClaimed(askOrder0.hash));
        expect(await erc721Mock0.ownerOf(0)).to.be.equal(alice.address);

        await mine(100);
        assert.isTrue(deadline0 < (await getBlockTimestamp()));
        await expect(erc721Exchange.claim(askOrder0.order)).to.be.revertedWith("SHOYU: FAILED_TO_TRANSFER_FUNDS");
        assert.isFalse(await erc721Exchange.isCancelledOrClaimed(askOrder0.hash));
        expect(await erc721Mock0.ownerOf(0)).to.be.equal(alice.address);
    });

    it("should be that fees are transfered properly", async () => {
        const {
            factory,
            erc721Exchange,
            erc721Mock0,
            erc721Mock1,
            exchangeName,
            erc20Mock,
            englishAuction,
            fixedPriceSale,
            protocolVault,
            operationalVault,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank, proxy } = getWallets();

        await erc721Mock0.safeMintBatch1(alice.address, [0, 1, 2, 3], []);
        await erc721Mock0.connect(alice).setApprovalForAll(erc721Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.connect(bob).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(carol).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(dan).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(erin).approve(erc721Exchange.address, 10000000);

        //protocol 25 operator 5 royalty 10
        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            1,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [12345])
        );
        const askOrder2 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            proxy.address,
            erc721Mock0.address,
            2,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline - 90,
            defaultAbiCoder.encode(["uint256"], [100])
        );
        const askOrder3 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            3,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [15000])
        );

        await bid2(erc721Exchange, bob, askOrder0.order, 1, 100, AddressZero);
        await checkEvent(erc721Exchange, "Bid", [askOrder0.hash, bob.address, 1, 100, AddressZero, AddressZero]);

        const fees0 = fees(12345, 25, 5, 0);
        await expect(() => bid2(erc721Exchange, carol, askOrder1.order, 1, 12345, AddressZero)).to.changeTokenBalances(
            erc20Mock,
            [carol, protocolVault, operationalVault, alice],
            [-12345, fees0[0], fees0[1], fees0[3]]
        );

        await erc20Mock.connect(dan).approve(proxy.address, 10000000);
        const bidOrder2 = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrder2.hash,
            dan,
            1,
            31313,
            dan.address,
            AddressZero
        );
        const fees1 = fees(31313, 25, 5, 0);
        await expect(() => bid1(erc721Exchange, proxy, askOrder2.order, bidOrder2.order)).to.changeTokenBalances(
            erc20Mock,
            [dan, protocolVault, operationalVault, alice, frank, proxy],
            [-31313, fees1[0], fees1[1], fees1[3], 0, 0]
        );

        await factory.setProtocolFeeRecipient(erin.address);
        await factory.setOperationalFeeRecipient(frank.address);
        await factory.setOperationalFee(17);

        //erin 25/1000 frank 17/1000
        const fees2 = fees(15000, 25, 17, 0);
        await expect(() => bid2(erc721Exchange, dan, askOrder3.order, 1, 15000, AddressZero)).to.changeTokenBalances(
            erc20Mock,
            [dan, erin, frank, alice, protocolVault, operationalVault],
            [-15000, fees2[0], fees2[1], fees2[3], 0, 0, 0]
        );

        await mine(100);

        const fees3 = fees(100, 25, 17, 0);
        assert.isTrue(deadline < (await getBlockTimestamp()));
        await expect(() => erc721Exchange.claim(askOrder0.order)).to.changeTokenBalances(
            erc20Mock,
            [bob, erin, frank, alice, protocolVault, operationalVault],
            [-100, fees3[0], fees3[1], fees3[3], 0, 0, 0]
        );

        await erc721Mock1.safeMint(alice.address, 0, []);
        await erc721Mock1.connect(alice).setApprovalForAll(erc721Exchange.address, true);

        const askOrder4 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock1.address,
            0,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline + 1000,
            defaultAbiCoder.encode(["uint256"], [11000])
        );

        //erin 25/1000 frank 17/1000
        const fees4 = fees(11000, 25, 17, 0);
        await erc20Mock.connect(dan).approve(erc721Exchange.address, 10000000);
        await expect(() => bid2(erc721Exchange, dan, askOrder4.order, 1, 11000, AddressZero)).to.changeTokenBalances(
            erc20Mock,
            [dan, erin, frank, alice, protocolVault, operationalVault],
            [-11000, fees4[0], fees4[1], fees4[3], 0, 0]
        );
    });

    it("should be that NFT721 tokens can't be traded on ERC721Exchange but the other ERC721 tokens can", async () => {
        const {
            factory,
            nft721,
            erc721Exchange,
            erc721Mock0,
            erc721Mock1,
            erc721Mock2,
            exchangeName,
            erc20Mock,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol } = getWallets();
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(alice.address, "Name", "Symbol", [0, 1, 2, 3], carol.address, 10);
        const nft721_0 = await getNFT721(factory);

        await factory.deployNFT721AndMintBatch(alice.address, "Name2", "Symbol2", [0, 1, 2, 3], carol.address, 10);
        const nft721_1 = await getNFT721(factory);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.connect(bob).approve(erc721Exchange.address, 10000000);

        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            nft721_0.address,
            0,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            nft721_1.address,
            2,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [50])
        );

        assert.isFalse(await erc721Exchange.canTrade(nft721_0.address));
        assert.isFalse(await erc721Exchange.canTrade(nft721_1.address));

        await expect(bid2(erc721Exchange, bob, askOrder0.order, 1, 50, AddressZero)).to.be.revertedWith(
            "SHOYU: INVALID_EXCHANGE"
        );
        await expect(bid2(erc721Exchange, bob, askOrder1.order, 1, 50, AddressZero)).to.be.revertedWith(
            "SHOYU: INVALID_EXCHANGE"
        );

        await erc721Mock0.safeMint(bob.address, 3, []);
        await erc721Mock1.safeMint(bob.address, 4, []);
        await erc721Mock2.safeMint(bob.address, 5, []);
        await erc721Mock0.connect(bob).setApprovalForAll(erc721Exchange.address, true);
        await erc721Mock1.connect(bob).setApprovalForAll(erc721Exchange.address, true);
        await erc721Mock2.connect(bob).setApprovalForAll(erc721Exchange.address, true);

        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.connect(carol).approve(erc721Exchange.address, 10000000);

        const askOrder3 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            bob,
            AddressZero,
            erc721Mock0.address,
            3,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrder4 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            bob,
            AddressZero,
            erc721Mock1.address,
            4,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrder5 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            bob,
            AddressZero,
            erc721Mock2.address,
            5,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [50])
        );

        assert.isTrue(await erc721Exchange.canTrade(erc721Mock0.address));
        assert.isTrue(await erc721Exchange.canTrade(erc721Mock1.address));
        assert.isTrue(await erc721Exchange.canTrade(erc721Mock2.address));

        await bid2(erc721Exchange, carol, askOrder3.order, 1, 50, AddressZero);
        await checkEvent(erc721Exchange, "Claim", [askOrder3.hash, carol.address, 1, 50, carol.address, AddressZero]);
        await bid2(erc721Exchange, carol, askOrder4.order, 1, 50, AddressZero);
        await checkEvent(erc721Exchange, "Claim", [askOrder4.hash, carol.address, 1, 50, carol.address, AddressZero]);
        await bid2(erc721Exchange, carol, askOrder5.order, 1, 50, AddressZero);
        await checkEvent(erc721Exchange, "Claim", [askOrder5.hash, carol.address, 1, 50, carol.address, AddressZero]);
    });

    it("should be that claimed orders can't be used again even if it's back to the initial owner", async () => {
        const {
            erc721Exchange,
            erc721Mock0,
            exchangeName,
            erc20Mock,
            englishAuction,
            dutchAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank, proxy } = getWallets();

        await erc721Mock0.safeMintBatch1(alice.address, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], []);
        await erc721Mock0.connect(alice).setApprovalForAll(erc721Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(bob).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(carol).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(dan).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(erin).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(frank).approve(erc721Exchange.address, 10000000);

        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            1,
            1,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentTime])
        );
        const askOrder2 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            2,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [100])
        );
        const askOrder3 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            proxy.address,
            erc721Mock0.address,
            3,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            currentTime + 5,
            defaultAbiCoder.encode(["uint256"], [100])
        );

        await bid2(erc721Exchange, bob, askOrder0.order, 1, 100, AddressZero);
        await checkEvent(erc721Exchange, "Bid", [askOrder0.hash, bob.address, 1, 100, AddressZero, AddressZero]);

        await bid2(erc721Exchange, carol, askOrder1.order, 1, 999, AddressZero);
        await checkEvent(erc721Exchange, "Claim", [askOrder1.hash, carol.address, 1, 999, carol.address, AddressZero]);

        await bid2(erc721Exchange, dan, askOrder2.order, 1, 100, AddressZero);
        await checkEvent(erc721Exchange, "Claim", [askOrder2.hash, dan.address, 1, 100, dan.address, AddressZero]);

        await erc20Mock.connect(dan).approve(proxy.address, 10000);
        const bidOrder3 = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrder3.hash,
            dan,
            1,
            101,
            dan.address,
            AddressZero
        );
        await bid1(erc721Exchange, proxy, askOrder3.order, bidOrder3.order);
        await checkEvent(erc721Exchange, "Claim", [askOrder3.hash, dan.address, 1, 101, dan.address, AddressZero]);

        await expect(bid2(erc721Exchange, carol, askOrder1.order, 1, 999, AddressZero)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );
        await expect(bid2(erc721Exchange, dan, askOrder2.order, 1, 100, AddressZero)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );

        const bidOrder3_ = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrder3.hash,
            dan,
            1,
            101,
            dan.address,
            AddressZero
        );
        await expect(bid1(erc721Exchange, proxy, askOrder3.order, bidOrder3_.order)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );

        await erc721Mock0.connect(carol).transferFrom(carol.address, alice.address, 1);
        await erc721Mock0.connect(dan).transferFrom(dan.address, alice.address, 2);
        await erc721Mock0.connect(dan).transferFrom(dan.address, alice.address, 3);

        await expect(bid2(erc721Exchange, carol, askOrder1.order, 1, 999, AddressZero)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );

        await expect(bid2(erc721Exchange, dan, askOrder2.order, 1, 100, AddressZero)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );

        await expect(bid1(erc721Exchange, proxy, askOrder3.order, bidOrder3_.order)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );

        await mine(100);
        await erc721Exchange.claim(askOrder0.order);

        await expect(bid2(erc721Exchange, bob, askOrder0.order, 1, 100, AddressZero)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );

        await erc721Mock0.connect(bob).transferFrom(bob.address, alice.address, 0);

        await expect(bid2(erc721Exchange, bob, askOrder0.order, 1, 100, AddressZero)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );
    });

    it("should be that BestBid is replaced if someone bid with higher price", async () => {
        const { erc721Exchange, erc721Mock0, exchangeName, erc20Mock, englishAuction } = await setupTest();

        const { alice, bob, carol, dan } = getWallets();

        await erc721Mock0.safeMint(alice.address, 0, []);
        await erc721Mock0.connect(alice).setApprovalForAll(erc721Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [50])
        );

        await bid2(erc721Exchange, bob, askOrder0.order, 1, 100, AddressZero);

        expect((await erc721Exchange.bestBid(askOrder0.hash))[0]).to.be.equal(bob.address);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[1]).to.be.equal(1);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[2]).to.be.equal(100);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[3]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[4]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[5]).to.be.equal(await getBlockTimestamp());

        await mine(11);
        await bid2(erc721Exchange, carol, askOrder0.order, 1, 110, AddressZero);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[0]).to.be.equal(carol.address);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[1]).to.be.equal(1);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[2]).to.be.equal(110);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[3]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[4]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[5]).to.be.equal(await getBlockTimestamp());

        await mine(11);
        await expect(bid2(erc721Exchange, dan, askOrder0.order, 1, 110, AddressZero)).to.be.revertedWith(
            "SHOYU: FAILURE"
        );

        await erc20Mock.mint(carol.address, 10000);
        await erc20Mock.connect(carol).approve(erc721Exchange.address, 10000);

        await mine(100);
        expect(await erc721Exchange.claim(askOrder0.order)).to.emit(erc721Exchange, "Claim");
        expect(await erc721Mock0.ownerOf(0)).to.be.equal(carol.address);
        expect(await erc20Mock.balanceOf(carol.address)).to.be.equal(10000 - 110);
    });

    it("should be that bid(Orders.Ask memory askOrder, Orders.Bid memory bidOrder) function works well", async () => {
        const {
            erc721Exchange,
            erc721Mock0,
            exchangeName,
            erc20Mock,
            englishAuction,
            dutchAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank } = getWallets();

        await erc721Mock0.safeMintBatch1(alice.address, [0, 1, 2], []);
        await erc721Mock0.connect(alice).setApprovalForAll(erc721Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(bob).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(carol).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(dan).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(erin).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(frank).approve(erc721Exchange.address, 10000000);

        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            1,
            1,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentTime])
        );
        const askOrder2 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            2,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [100])
        );

        const bidOrder0 = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrder0.hash,
            bob,
            1,
            101,
            AddressZero,
            AddressZero
        );
        const bidOrder1 = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrder1.hash,
            carol,
            1,
            990,
            AddressZero,
            AddressZero
        );
        const bidOrder2 = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrder2.hash,
            dan,
            1,
            100,
            AddressZero,
            AddressZero
        );

        await bid1(erc721Exchange, frank, askOrder1.order, bidOrder1.order);
        await checkEvent(erc721Exchange, "Claim", [askOrder1.hash, carol.address, 1, 990, carol.address, AddressZero]);
        await bid1(erc721Exchange, bob, askOrder2.order, bidOrder2.order);
        await checkEvent(erc721Exchange, "Claim", [askOrder2.hash, dan.address, 1, 100, dan.address, AddressZero]);
        await bid1(erc721Exchange, alice, askOrder0.order, bidOrder0.order);
        await checkEvent(erc721Exchange, "Bid", [askOrder0.hash, bob.address, 1, 101, AddressZero, AddressZero]);

        expect((await erc721Exchange.bestBid(askOrder0.hash))[0]).to.be.equal(bob.address);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[1]).to.be.equal(1);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[2]).to.be.equal(101);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[3]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[4]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[5]).to.be.equal(await getBlockTimestamp());

        await mine(15);

        const bidOrder0_ = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrder0.hash,
            carol,
            1,
            111,
            AddressZero,
            AddressZero
        );

        await bid1(erc721Exchange, alice, askOrder0.order, bidOrder0_.order);
        await checkEvent(erc721Exchange, "Bid", [askOrder0.hash, carol.address, 1, 111, AddressZero, AddressZero]);

        expect((await erc721Exchange.bestBid(askOrder0.hash))[0]).to.be.equal(carol.address);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[1]).to.be.equal(1);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[2]).to.be.equal(111);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[3]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[4]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[5]).to.be.equal(await getBlockTimestamp());
    });

    it("should be that fees and nft go to recipients if they are set in orders", async () => {
        const {
            operationalVault,
            protocolVault,
            erc721Exchange,
            erc721Mock0,
            exchangeName,
            erc20Mock,
            englishAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank } = getWallets();

        await erc721Mock0.safeMintBatch1(alice.address, [0, 1], []);
        await erc721Mock0.connect(alice).setApprovalForAll(erc721Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.connect(bob).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(carol).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(dan).approve(erc721Exchange.address, 10000000);

        //protocol 25 operator 5 royalty 10
        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            erin.address,
            deadline,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            1,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            frank.address,
            deadline,
            defaultAbiCoder.encode(["uint256"], [12345])
        );

        await bid2(erc721Exchange, bob, askOrder0.order, 1, 100, dan.address);
        await checkEvent(erc721Exchange, "Bid", [askOrder0.hash, bob.address, 1, 100, dan.address, AddressZero]);

        const fees0 = fees(12345, 25, 5, 0);
        await expect(() => bid2(erc721Exchange, carol, askOrder1.order, 1, 12345, bob.address)).to.changeTokenBalances(
            erc20Mock,
            [carol, protocolVault, operationalVault, frank, alice],
            [-12345, fees0[0], fees0[1], fees0[3], 0]
        );
        expect(await erc721Mock0.ownerOf(1)).to.be.equal(bob.address);

        await mine(100);

        const fees1 = fees(100, 25, 5, 0);
        await expect(() => erc721Exchange.claim(askOrder0.order)).to.changeTokenBalances(
            erc20Mock,
            [bob, protocolVault, operationalVault, erin, alice],
            [-100, fees1[0], fees1[1], fees1[3], 0]
        );
        expect(await erc721Mock0.ownerOf(0)).to.be.equal(dan.address);
    });

    it("should be that token implementing EIP2981 give royalty to recipient when auction is finished", async () => {
        const {
            deployer,
            operationalVault,
            protocolVault,
            erc721Exchange,
            exchangeName,
            erc20Mock,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol } = getWallets();

        const ERC721RoyaltyMockContract = await ethers.getContractFactory("ERC721RoyaltyMock");
        const erc721RoyaltyMock0 = (await ERC721RoyaltyMockContract.deploy()) as ERC721RoyaltyMock;

        await erc721RoyaltyMock0.safeMintBatch1(alice.address, [0, 1, 20], []);
        await erc721RoyaltyMock0.connect(alice).setApprovalForAll(erc721Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.connect(bob).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(carol).approve(erc721Exchange.address, 10000000);

        expect((await erc721RoyaltyMock0.royaltyInfo(1, 1000))[0]).to.be.equal(deployer.address);
        expect((await erc721RoyaltyMock0.royaltyInfo(1, 1000))[1]).to.be.equal(10);
        expect((await erc721RoyaltyMock0.royaltyInfo(20, 1000))[0]).to.be.equal(deployer.address);
        expect((await erc721RoyaltyMock0.royaltyInfo(20, 1000))[1]).to.be.equal(100);

        //protocol 25 operator 5 royalty 10
        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721RoyaltyMock0.address,
            1,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            alice.address,
            deadline,
            defaultAbiCoder.encode(["uint256"], [12345])
        );

        const fees0 = fees(12345, 25, 5, 10);
        await expect(() =>
            bid2(erc721Exchange, carol, askOrder0.order, 1, 12345, carol.address)
        ).to.changeTokenBalances(
            erc20Mock,
            [carol, protocolVault, operationalVault, deployer, alice],
            [-12345, fees0[0], fees0[1], fees0[2], fees0[3]]
        );
        expect(await erc721RoyaltyMock0.ownerOf(1)).to.be.equal(carol.address);

        //protocol 25 operator 5 royalty 100
        const askOrder1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721RoyaltyMock0.address,
            20,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            alice.address,
            deadline,
            defaultAbiCoder.encode(["uint256"], [54321])
        );

        const fees1 = fees(54321, 25, 5, 100);
        await expect(() => bid2(erc721Exchange, bob, askOrder1.order, 1, 54321, bob.address)).to.changeTokenBalances(
            erc20Mock,
            [bob, protocolVault, operationalVault, deployer, alice],
            [-54321, fees1[0], fees1[1], fees1[2], fees1[3]]
        );
        expect(await erc721RoyaltyMock0.ownerOf(20)).to.be.equal(bob.address);
    });

    it("should be that bid and claim functions work properly with proxy", async () => {
        const {
            erc721Exchange,
            erc721Mock0,
            exchangeName,
            erc20Mock,
            englishAuction,
            dutchAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank, proxy } = getWallets();

        await erc721Mock0.safeMintBatch1(alice.address, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], []);
        await erc721Mock0.connect(alice).setApprovalForAll(erc721Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(dan).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(erin).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(frank).approve(erc721Exchange.address, 10000000);

        const askOrderEwithP = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            proxy.address,
            erc721Mock0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            currentTime + 30,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrderEwithoutP = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            1,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            currentTime + 30,
            defaultAbiCoder.encode(["uint256"], [50])
        );

        const askOrderFwithP = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            proxy.address,
            erc721Mock0.address,
            2,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [200])
        );
        const askOrderFwithoutP = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            3,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [201])
        );

        const askOrderDwithP = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            proxy.address,
            erc721Mock0.address,
            4,
            1,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentTime])
        );
        const askOrderDwithoutP = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            5,
            1,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentTime])
        );

        const bidOrderEwithP = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrderEwithP.hash,
            dan,
            1,
            100,
            AddressZero,
            AddressZero
        );
        const bidOrderEwithoutP = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrderEwithoutP.hash,
            dan,
            1,
            101,
            AddressZero,
            AddressZero
        );

        await expect(bid1(erc721Exchange, bob, askOrderEwithP.order, bidOrderEwithP.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );
        await expect(bid1(erc721Exchange, proxy, askOrderEwithP.order, bidOrderEwithP.order)).to.be.revertedWith(
            "SHOYU: FAILURE"
        );

        await bid1(erc721Exchange, bob, askOrderEwithoutP.order, bidOrderEwithoutP.order);
        await checkEvent(erc721Exchange, "Bid", [
            askOrderEwithoutP.hash,
            dan.address,
            1,
            101,
            AddressZero,
            AddressZero,
        ]);

        await mine(30);
        await expect(erc721Exchange.connect(carol).claim(askOrderEwithP.order)).to.be.revertedWith("SHOYU: FAILURE");
        await bid1(erc721Exchange, proxy, askOrderEwithP.order, bidOrderEwithP.order);
        await checkEvent(erc721Exchange, "Claim", [askOrderEwithP.hash, dan.address, 1, 100, dan.address, AddressZero]);

        expect(await erc721Exchange.connect(carol).claim(askOrderEwithoutP.order)).to.emit(erc721Exchange, "Claim");
        expect(await erc721Mock0.ownerOf(0)).to.be.equal(dan.address);
        expect(await erc721Mock0.ownerOf(1)).to.be.equal(dan.address);

        const bidOrderFwithP = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrderFwithP.hash,
            erin,
            1,
            200,
            AddressZero,
            AddressZero
        );
        const bidOrderFwithoutP = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrderFwithoutP.hash,
            erin,
            1,
            201,
            AddressZero,
            AddressZero
        );

        await expect(bid1(erc721Exchange, bob, askOrderFwithP.order, bidOrderFwithP.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );
        await bid1(erc721Exchange, proxy, askOrderFwithP.order, bidOrderFwithP.order);
        await checkEvent(erc721Exchange, "Claim", [
            askOrderFwithP.hash,
            erin.address,
            1,
            200,
            erin.address,
            AddressZero,
        ]);

        await bid1(erc721Exchange, bob, askOrderFwithoutP.order, bidOrderFwithoutP.order);
        await checkEvent(erc721Exchange, "Claim", [
            askOrderFwithoutP.hash,
            erin.address,
            1,
            201,
            erin.address,
            AddressZero,
        ]);
        expect(await erc721Mock0.ownerOf(2)).to.be.equal(erin.address);
        expect(await erc721Mock0.ownerOf(3)).to.be.equal(erin.address);

        const bidOrderDwithP = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrderDwithP.hash,
            frank,
            1,
            990,
            AddressZero,
            AddressZero
        );
        const bidOrderDwithoutP = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrderDwithoutP.hash,
            frank,
            1,
            980,
            AddressZero,
            AddressZero
        );

        await expect(bid1(erc721Exchange, bob, askOrderDwithP.order, bidOrderDwithP.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );
        await bid1(erc721Exchange, proxy, askOrderDwithP.order, bidOrderDwithP.order);
        await checkEvent(erc721Exchange, "Claim", [
            askOrderDwithP.hash,
            frank.address,
            1,
            990,
            frank.address,
            AddressZero,
        ]);

        await bid1(erc721Exchange, bob, askOrderDwithoutP.order, bidOrderDwithoutP.order);
        await checkEvent(erc721Exchange, "Claim", [
            askOrderDwithoutP.hash,
            frank.address,
            1,
            980,
            frank.address,
            AddressZero,
        ]);

        expect(await erc721Mock0.ownerOf(4)).to.be.equal(frank.address);
        expect(await erc721Mock0.ownerOf(5)).to.be.equal(frank.address);

        const askOrderFwithP1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            proxy.address,
            erc721Mock0.address,
            6,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [200])
        );
        const askOrderFwithoutP1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            7,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [201])
        );

        const askOrderDwithP1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            proxy.address,
            erc721Mock0.address,
            8,
            1,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentTime])
        );
        const askOrderDwithoutP1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            AddressZero,
            erc721Mock0.address,
            9,
            1,
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
            erc721Exchange.address,
            askOrderFwithP1.hash,
            erin,
            1,
            200,
            AddressZero,
            AddressZero
        );
        const bidOrderFwithoutP1 = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrderFwithoutP1.hash,
            erin,
            1,
            201,
            AddressZero,
            AddressZero
        );

        await bid1(erc721Exchange, proxy, askOrderFwithP1.order, bidOrderFwithP1.order);
        await checkEvent(erc721Exchange, "Claim", [
            askOrderFwithP1.hash,
            erin.address,
            1,
            200,
            erin.address,
            AddressZero,
        ]);
        await expect(bid1(erc721Exchange, bob, askOrderFwithoutP1.order, bidOrderFwithoutP1.order)).to.be.revertedWith(
            "SHOYU: FAILURE"
        );

        const bidOrderDwithP1 = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrderDwithP1.hash,
            frank,
            1,
            990,
            AddressZero,
            AddressZero
        );
        const bidOrderDwithoutP1 = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrderDwithoutP1.hash,
            frank,
            1,
            980,
            AddressZero,
            AddressZero
        );

        await bid1(erc721Exchange, proxy, askOrderDwithP1.order, bidOrderDwithP1.order);
        await checkEvent(erc721Exchange, "Claim", [
            askOrderDwithP1.hash,
            frank.address,
            1,
            990,
            frank.address,
            AddressZero,
        ]);
        await expect(bid1(erc721Exchange, bob, askOrderDwithoutP1.order, bidOrderDwithoutP1.order)).to.be.revertedWith(
            "SHOYU: FAILURE"
        );
    });

    it("should be that bid and claim functions work properly with _bidHashes", async () => {
        const {
            erc721Exchange,
            erc721Mock0,
            exchangeName,
            erc20Mock,
            englishAuction,
            dutchAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, carol, dan, erin, frank, proxy } = getWallets();

        await erc721Mock0.safeMintBatch1(alice.address, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], []);
        await erc721Mock0.connect(alice).setApprovalForAll(erc721Exchange.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(dan).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(erin).approve(erc721Exchange.address, 10000000);
        await erc20Mock.connect(frank).approve(erc721Exchange.address, 10000000);

        const askOrderE0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            proxy.address,
            erc721Mock0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            currentTime + 30,
            defaultAbiCoder.encode(["uint256"], [50])
        );
        const askOrderE1 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            proxy.address,
            erc721Mock0.address,
            1,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            currentTime + 30,
            defaultAbiCoder.encode(["uint256"], [50])
        );

        const askOrderF0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            proxy.address,
            erc721Mock0.address,
            2,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [200])
        );

        const askOrderD0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            proxy.address,
            erc721Mock0.address,
            4,
            1,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentTime])
        );

        const bidOrderE0 = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrderE0.hash,
            dan,
            1,
            100,
            AddressZero,
            AddressZero
        );
        const bidOrderE1 = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrderE1.hash,
            dan,
            1,
            101,
            AddressZero,
            AddressZero
        );

        expect(await erc721Exchange.approvedBidHash(proxy.address, askOrderE0.hash, dan.address)).to.be.equal(HashZero);
        await expect(erc721Exchange.connect(proxy).updateApprovedBidHash(askOrderE0.hash, dan.address, bidOrderE0.hash))
            .to.emit(erc721Exchange, "UpdateApprovedBidHash")
            .withArgs(proxy.address, askOrderE0.hash, dan.address, bidOrderE0.hash);
        expect(await erc721Exchange.approvedBidHash(proxy.address, askOrderE0.hash, dan.address)).to.be.equal(
            bidOrderE0.hash
        );

        await expect(
            bid2(
                erc721Exchange,
                dan,
                askOrderE0.order,
                bidOrderE0.order.amount,
                bidOrderE0.order.price,
                bidOrderE0.order.recipient
            )
        ).to.be.revertedWith("SHOYU: FORBIDDEN");

        await mine(30);
        await expect(erc721Exchange.connect(carol).claim(askOrderE0.order)).to.be.revertedWith("SHOYU: FAILURE");
        await bid1(erc721Exchange, frank, askOrderE0.order, bidOrderE0.order); //frank can call
        await checkEvent(erc721Exchange, "Claim", [askOrderE0.hash, dan.address, 1, 100, dan.address, AddressZero]);
        expect(await erc721Exchange.approvedBidHash(proxy.address, askOrderE0.hash, dan.address)).to.be.equal(HashZero);

        const bidOrderE1_ = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrderE1.hash,
            dan,
            1,
            70,
            AddressZero,
            AddressZero
        );
        await erc721Exchange.connect(dan).updateApprovedBidHash(askOrderE1.hash, dan.address, bidOrderE1_.hash); //make fake hash for abusing
        expect(await erc721Exchange.approvedBidHash(dan.address, askOrderE1.hash, dan.address)).to.be.equal(
            bidOrderE1_.hash
        );
        expect(await erc721Exchange.approvedBidHash(proxy.address, askOrderE1.hash, dan.address)).to.be.equal(HashZero);
        await expect(bid1(erc721Exchange, dan, askOrderE1.order, bidOrderE1_.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );

        expect(await getBlockTimestamp()).to.be.gt(askOrderE1.order.deadline);
        await erc721Exchange.connect(proxy).updateApprovedBidHash(askOrderE1.hash, dan.address, bidOrderE1.hash); //timeover but update available
        expect(await erc721Exchange.approvedBidHash(proxy.address, askOrderE1.hash, dan.address)).to.be.equal(
            bidOrderE1.hash
        );

        const bidOrderE1__ = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrderE1.hash,
            dan,
            1,
            70,
            AddressZero,
            AddressZero
        ); //change conditions after hash approved
        await expect(bid1(erc721Exchange, dan, askOrderE1.order, bidOrderE1__.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );

        await bid1(erc721Exchange, dan, askOrderE1.order, bidOrderE1.order);
        await checkEvent(erc721Exchange, "Claim", [askOrderE1.hash, dan.address, 1, 101, dan.address, AddressZero]);
        expect(await erc721Exchange.approvedBidHash(proxy.address, askOrderE1.hash, dan.address)).to.be.equal(HashZero);
        expect(await erc721Mock0.ownerOf(1)).to.be.equal(dan.address);

        const bidOrderF0 = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrderF0.hash,
            erin,
            1,
            200,
            AddressZero,
            AddressZero
        );

        await mine(100);
        expect(await getBlockTimestamp()).to.be.gt(askOrderF0.order.deadline);
        await erc721Exchange.connect(proxy).updateApprovedBidHash(askOrderF0.hash, erin.address, bidOrderF0.hash); //timeover but update available
        expect(await erc721Exchange.approvedBidHash(proxy.address, askOrderF0.hash, erin.address)).to.be.equal(
            bidOrderF0.hash
        );

        await bid1(erc721Exchange, erin, askOrderF0.order, bidOrderF0.order);
        await checkEvent(erc721Exchange, "Claim", [askOrderF0.hash, erin.address, 1, 200, erin.address, AddressZero]);
        expect(await erc721Exchange.approvedBidHash(proxy.address, askOrderF0.hash, erin.address)).to.be.equal(
            HashZero
        );
        expect(await erc721Mock0.ownerOf(2)).to.be.equal(erin.address);

        const bidOrderD0 = await signBid(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            askOrderD0.hash,
            frank,
            1,
            990,
            AddressZero,
            AddressZero
        );
        expect(await getBlockTimestamp()).to.be.gt(askOrderD0.order.deadline);
        await erc721Exchange.connect(proxy).updateApprovedBidHash(askOrderD0.hash, frank.address, bidOrderD0.hash); //timeover but update available
        expect(await erc721Exchange.approvedBidHash(proxy.address, askOrderD0.hash, frank.address)).to.be.equal(
            bidOrderD0.hash
        );

        await bid1(erc721Exchange, frank, askOrderD0.order, bidOrderD0.order);
        await checkEvent(erc721Exchange, "Claim", [askOrderD0.hash, frank.address, 1, 990, frank.address, AddressZero]);
        expect(await erc721Exchange.approvedBidHash(proxy.address, askOrderD0.hash, frank.address)).to.be.equal(
            HashZero
        );
        expect(await erc721Mock0.ownerOf(4)).to.be.equal(frank.address);
    });
});
