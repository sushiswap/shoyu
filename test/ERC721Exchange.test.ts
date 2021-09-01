import {
    TokenFactory,
    NFT721V0,
    ERC721Mock,
    ERC20Mock,
    EnglishAuction,
    DutchAuction,
    FixedPriceSale,
    DesignatedSale,
    ExchangeProxy,
    ERC721ExchangeV0,
} from "../typechain";

import { domainSeparator, signAsk, signBid } from "./utils/sign-utils";
import { bid1, bid2 } from "./utils/bid_utils";
import { ethers } from "hardhat";
import { BigNumber, BigNumberish, Wallet, Contract } from "ethers";
import { expect, assert } from "chai";
import { defaultAbiCoder } from "ethers/lib/utils";
import { getBlock, mine } from "./utils/blocks";

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

    const NFT721Contract = await ethers.getContractFactory("NFT721V0");
    const nft721 = (await NFT721Contract.deploy()) as NFT721V0;

    const FixedPriceSaleContract = await ethers.getContractFactory("FixedPriceSale");
    const fixedPriceSale = (await FixedPriceSaleContract.deploy()) as FixedPriceSale;
    await factory.setStrategyWhitelisted(fixedPriceSale.address, true);

    const EnglishAuctionContract = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = (await EnglishAuctionContract.deploy()) as EnglishAuction;
    await factory.setStrategyWhitelisted(englishAuction.address, true);

    const DutchAuctionContract = await ethers.getContractFactory("DutchAuction");
    const dutchAuction = (await DutchAuctionContract.deploy()) as DutchAuction;
    await factory.setStrategyWhitelisted(dutchAuction.address, true);

    const DesignatedSale = await ethers.getContractFactory("DesignatedSale");
    const designatedSale = (await DesignatedSale.deploy()) as DesignatedSale;
    await factory.setStrategyWhitelisted(designatedSale.address, true);

    const ExchangeProxy = await ethers.getContractFactory("ExchangeProxy");
    const exchangeProxy = (await ExchangeProxy.deploy()) as ExchangeProxy;

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
        designatedSale,
        exchangeProxy,
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

async function getNFT721(factory: TokenFactory): Promise<NFT721V0> {
    let events: any = await factory.queryFilter(factory.filters.DeployNFT721AndMintBatch(), "latest");
    if (events.length == 0) events = await factory.queryFilter(factory.filters.DeployNFT721AndPark(), "latest");
    const NFT721Contract = await ethers.getContractFactory("NFT721V0");
    return (await NFT721Contract.attach(events[0].args[0])) as NFT721V0;
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

        return { alice, bob, carol, dan, erin, frank };
    }
    function fees(price: BigNumberish, protocol: number, operator: number, royalty: number): BigNumberish[] {
        assert.isBelow(protocol, 255);
        assert.isBelow(operator, 255);
        assert.isBelow(royalty, 255);

        const fee: BigNumberish[] = [];

        const p = BigNumber.from(price).mul(protocol).div(1000);
        const o = BigNumber.from(price).mul(operator).div(1000);
        const r = BigNumber.from(price).sub(p.add(o)).mul(royalty).div(1000);
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

        const currentBlock = await getBlock();
        const deadline0 = currentBlock + 100;
        expect(await erc721Mock0.ownerOf(0)).to.be.equal(alice.address);
        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
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

        const currentBlock = await getBlock();
        const deadline0 = currentBlock + 100;
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
        assert.isTrue(deadline0 < (await getBlock()));

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
            designatedSale,
            exchangeProxy,
        } = await setupTest();

        const { alice } = getWallets();

        await erc721Mock0.safeMintBatch1(alice.address, [0, 1, 2, 3], []);
        await erc721Mock0.connect(alice).setApprovalForAll(erc721Exchange.address, true);

        const currentBlock = await getBlock();
        const deadline0 = currentBlock + 100;
        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
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
            erc721Mock0.address,
            1,
            1,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentBlock])
        );
        const askOrder2 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
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
            erc721Mock0.address,
            3,
            1,
            designatedSale.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "address"], [100, exchangeProxy.address])
        );

        expect((await erc721Exchange.bestBid(askOrder0.hash))[0]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder1.hash))[0]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder2.hash))[0]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder3.hash))[0]).to.be.equal(AddressZero);

        await expect(erc721Exchange.claim(askOrder3.order)).to.be.revertedWith("SHOYU: FAILURE");

        await expect(erc721Exchange.claim(askOrder2.order)).to.be.revertedWith("SHOYU: FAILURE");

        await expect(erc721Exchange.claim(askOrder1.order)).to.be.revertedWith("SHOYU: FAILURE");

        await expect(erc721Exchange.claim(askOrder0.order)).to.be.revertedWith("SHOYU: FAILURE");
        assert.isFalse(deadline0 < (await getBlock()));
        assert.isFalse(await erc721Exchange.isCancelledOrClaimed(askOrder0.hash));
        expect(await erc721Mock0.ownerOf(0)).to.be.equal(alice.address);

        await mine(100);
        assert.isTrue(deadline0 < (await getBlock()));
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
            designatedSale,
            exchangeProxy,
            protocolVault,
            operationalVault,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank } = getWallets();

        await erc721Mock0.safeMintBatch1(alice.address, [0, 1, 2, 3], []);
        await erc721Mock0.connect(alice).setApprovalForAll(erc721Exchange.address, true);

        const currentBlock = await getBlock();
        const deadline = currentBlock + 100;

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
            erc721Mock0.address,
            2,
            1,
            designatedSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "address"], [100, exchangeProxy.address])
        );
        const askOrder3 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
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

        await erc20Mock.connect(dan).approve(exchangeProxy.address, 10000000);
        await exchangeProxy.setClaimerWhitelisted(frank.address, true);
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
        await expect(() =>
            exchangeProxy.connect(frank).claim(erc721Exchange.address, askOrder2.order, bidOrder2.order)
        ).to.changeTokenBalances(
            erc20Mock,
            [dan, protocolVault, operationalVault, alice, frank, exchangeProxy],
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
        assert.isTrue(deadline < (await getBlock()));
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

        const currentBlock = await getBlock();
        const deadline = currentBlock + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.connect(bob).approve(erc721Exchange.address, 10000000);

        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
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
            designatedSale,
            exchangeProxy,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank } = getWallets();

        await erc721Mock0.safeMintBatch1(alice.address, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], []);
        await erc721Mock0.connect(alice).setApprovalForAll(erc721Exchange.address, true);

        const currentBlock = await getBlock();
        const deadline = currentBlock + 100;

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
            erc721Mock0.address,
            1,
            1,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentBlock])
        );
        const askOrder2 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
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
            erc721Mock0.address,
            3,
            1,
            designatedSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "address"], [100, exchangeProxy.address])
        );

        await bid2(erc721Exchange, bob, askOrder0.order, 1, 100, AddressZero);
        await checkEvent(erc721Exchange, "Bid", [askOrder0.hash, bob.address, 1, 100, AddressZero, AddressZero]);

        await bid2(erc721Exchange, carol, askOrder1.order, 1, 999, AddressZero);
        await checkEvent(erc721Exchange, "Claim", [askOrder1.hash, carol.address, 1, 999, carol.address, AddressZero]);

        await bid2(erc721Exchange, dan, askOrder2.order, 1, 100, AddressZero);
        await checkEvent(erc721Exchange, "Claim", [askOrder2.hash, dan.address, 1, 100, dan.address, AddressZero]);

        await erc20Mock.connect(dan).approve(exchangeProxy.address, 10000);
        await exchangeProxy.setClaimerWhitelisted(frank.address, true);
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
        await exchangeProxy.connect(frank).claim(erc721Exchange.address, askOrder3.order, bidOrder3.order);
        await checkEvent(erc721Exchange, "Claim", [
            askOrder3.hash,
            exchangeProxy.address,
            1,
            101,
            dan.address,
            AddressZero,
        ]);

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
        await expect(
            exchangeProxy.connect(frank).claim(erc721Exchange.address, askOrder3.order, bidOrder3_.order)
        ).to.be.revertedWith("SHOYU: SOLD_OUT");

        await erc721Mock0.connect(carol).transferFrom(carol.address, alice.address, 1);
        await erc721Mock0.connect(dan).transferFrom(dan.address, alice.address, 2);
        await erc721Mock0.connect(dan).transferFrom(dan.address, alice.address, 3);

        await expect(bid2(erc721Exchange, carol, askOrder1.order, 1, 999, AddressZero)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );

        await expect(bid2(erc721Exchange, dan, askOrder2.order, 1, 100, AddressZero)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );

        await expect(
            exchangeProxy.connect(frank).claim(erc721Exchange.address, askOrder3.order, bidOrder3_.order)
        ).to.be.revertedWith("SHOYU: SOLD_OUT");

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

        const currentBlock = await getBlock();
        const deadline = currentBlock + 100;

        const askOrder0 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
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
        expect((await erc721Exchange.bestBid(askOrder0.hash))[5]).to.be.equal(await ethers.provider.getBlockNumber());

        await mine(11);
        await bid2(erc721Exchange, carol, askOrder0.order, 1, 110, AddressZero);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[0]).to.be.equal(carol.address);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[1]).to.be.equal(1);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[2]).to.be.equal(110);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[3]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[4]).to.be.equal(AddressZero);
        expect((await erc721Exchange.bestBid(askOrder0.hash))[5]).to.be.equal(await ethers.provider.getBlockNumber());

        await mine(11);
        await expect(bid2(erc721Exchange, dan, askOrder0.order, 1, 110, AddressZero)).to.be.revertedWith(
            "SHOYU: FAILURE"
        );
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
            designatedSale,
            exchangeProxy,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank } = getWallets();

        await erc721Mock0.safeMintBatch1(alice.address, [0, 1, 2], []);
        await erc721Mock0.connect(alice).setApprovalForAll(erc721Exchange.address, true);

        const currentBlock = await getBlock();
        const deadline = currentBlock + 100;

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
            erc721Mock0.address,
            1,
            1,
            dutchAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentBlock])
        );
        const askOrder2 = await signAsk(
            ethers.provider,
            exchangeName,
            erc721Exchange.address,
            alice,
            erc721Mock0.address,
            2,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256"], [100])
        );

        await erc20Mock.connect(dan).approve(exchangeProxy.address, 1000);
        await exchangeProxy.setClaimerWhitelisted(frank.address, true);

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
        expect((await erc721Exchange.bestBid(askOrder0.hash))[5]).to.be.equal(await ethers.provider.getBlockNumber());

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
        expect((await erc721Exchange.bestBid(askOrder0.hash))[5]).to.be.equal(await ethers.provider.getBlockNumber());
    });

    it("should be that fees and nft go to receipients if they are set in orders", async () => {
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

        const currentBlock = await getBlock();
        const deadline = currentBlock + 100;

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
});
