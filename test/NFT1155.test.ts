import {
    TokenFactory,
    ERC1155Mock,
    ERC20Mock,
    EnglishAuction,
    DutchAuction,
    FixedPriceSale,
    NFT1155V3,
    StaticCallMock,
} from "./typechain";

import { sign, convertToHash, domainSeparator, getDigest, getHash, signAsk, signBid } from "./utils/sign-utils";
import { bid1, bid2 } from "./utils/bid_utils";
import { ethers } from "hardhat";
import { BigNumber, BigNumberish, Wallet, Contract } from "ethers";
import { expect, assert } from "chai";
import { solidityPack, toUtf8String, defaultAbiCoder } from "ethers/lib/utils";
import { getBlockTimestamp, mine } from "./utils/blocks";

const { constants } = ethers;
const { AddressZero, HashZero } = constants;

ethers.utils.Logger.setLogLevel(ethers.utils.Logger.levels.ERROR); // turn off warnings

const setupTest = async () => {
    const signers = await ethers.getSigners();
    const [deployer, protocolVault, operationalVault, alice, bob, carol, royaltyVault] = signers;

    const TokenFactoryContract = await ethers.getContractFactory("TokenFactory");
    const factory = (await TokenFactoryContract.deploy(
        protocolVault.address,
        25,
        operationalVault.address,
        5,
        "https://nft721.sushi.com/",
        "https://nft1155.sushi.com/"
    )) as TokenFactory;

    const NFT1155Contract = await ethers.getContractFactory("NFT1155V3");
    const nft1155 = (await NFT1155Contract.deploy()) as NFT1155V3;

    const ERC1155MockContract = await ethers.getContractFactory("ERC1155Mock");
    const erc1155Mock = (await ERC1155MockContract.deploy()) as ERC1155Mock;

    const ERC20MockContract = await ethers.getContractFactory("ERC20Mock");
    const erc20Mock = (await ERC20MockContract.deploy()) as ERC20Mock;

    const EnglishAuction = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = (await EnglishAuction.deploy()) as EnglishAuction;

    const DutchAuction = await ethers.getContractFactory("DutchAuction");
    const dutchAuction = (await DutchAuction.deploy()) as DutchAuction;

    const FixedPriceSale = await ethers.getContractFactory("FixedPriceSale");
    const fixedPriceSale = (await FixedPriceSale.deploy()) as FixedPriceSale;

    return {
        deployer,
        protocolVault,
        operationalVault,
        factory,
        nft1155,
        alice,
        bob,
        carol,
        royaltyVault,
        erc1155Mock,
        erc20Mock,
        englishAuction,
        dutchAuction,
        fixedPriceSale,
    };
};

async function getNFT1155(factory: TokenFactory): Promise<NFT1155V3> {
    const events = await factory.queryFilter(factory.filters.DeployNFT1155AndMintBatch(), "latest");
    const NFT1155Contract = await ethers.getContractFactory("NFT1155V3");
    return (await NFT1155Contract.attach(events[0].args[0])) as NFT1155V3;
}

describe("NFT part of NFT1155", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    it("should be that default values are set correctly with batch minting deploy", async () => {
        const { factory, nft1155, alice, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        await factory.deployNFT1155AndMintBatch(alice.address, [0, 2, 4], [1, 3, 5], royaltyVault.address, 13);
        const nft1155_0 = await getNFT1155(factory);

        expect(await nft1155_0.PERMIT_TYPEHASH()).to.be.equal(
            convertToHash("Permit(address owner,address spender,uint256 nonce,uint256 deadline)")
        );
        expect(await nft1155_0.DOMAIN_SEPARATOR()).to.be.equal(
            await domainSeparator(ethers.provider, nft1155_0.address.toLowerCase(), nft1155_0.address)
        );
        expect(await nft1155_0.factory()).to.be.equal(factory.address);

        async function URI1155(nft: NFT1155V3, tokenId: number): Promise<string> {
            const baseURI = await factory.baseURI1155();
            const addy = nft.address.toLowerCase();
            return toUtf8String(solidityPack(["string", "string", "string"], [baseURI, addy, "/" + tokenId + ".json"]));
        }

        expect(await nft1155_0.uri(0)).to.be.equal(await URI1155(nft1155_0, 0));
        expect(await nft1155_0.uri(2)).to.be.equal(await URI1155(nft1155_0, 2));
        expect(await nft1155_0.uri(4)).to.be.equal(await URI1155(nft1155_0, 4));
        expect(await nft1155_0.uri(1)).to.be.equal(await URI1155(nft1155_0, 1));
        expect(await nft1155_0.uri(11759)).to.be.equal(await URI1155(nft1155_0, 11759));

        expect((await nft1155_0.royaltyInfo(0, 0))[0]).to.be.equal(royaltyVault.address);

        expect((await nft1155_0.royaltyInfo(0, 12345))[1]).to.be.equal(Math.floor((12345 * 13) / 1000));
    });

    it("should be that permit fuctions work well", async () => {
        const { factory, nft1155, alice, bob, carol, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        const artist = ethers.Wallet.createRandom();

        await factory.deployNFT1155AndMintBatch(artist.address, [0, 1, 2], [5, 6, 7], royaltyVault.address, 10);
        const nft1155_0 = await getNFT1155(factory);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;
        const permitDigest0 = await getDigest(
            ethers.provider,
            nft1155_0.address.toLowerCase(),
            nft1155_0.address,
            getHash(
                ["bytes32", "address", "address", "uint256", "uint256"],
                [await nft1155_0.PERMIT_TYPEHASH(), artist.address, bob.address, 0, deadline]
            )
        );
        const { v: v0, r: r0, s: s0 } = sign(permitDigest0, artist);

        expect(await nft1155_0.isApprovedForAll(artist.address, bob.address)).to.be.false;
        await nft1155_0.permit(artist.address, bob.address, deadline, v0, r0, s0);
        expect(await nft1155_0.isApprovedForAll(artist.address, bob.address)).to.be.true;

        const { v: v1, r: r1, s: s1 } = sign(
            await getDigest(
                ethers.provider,
                nft1155_0.address.toLowerCase(),
                nft1155_0.address,
                getHash(
                    ["bytes32", "address", "address", "uint256", "uint256"],
                    [await nft1155_0.PERMIT_TYPEHASH(), artist.address, alice.address, 1, deadline]
                )
            ),
            artist
        );

        const { v: fv0, r: fr0, s: fs0 } = sign(
            await getDigest(
                ethers.provider,
                nft1155_0.address.toLowerCase(),
                nft1155_0.address,
                getHash(
                    ["bytes32", "address", "address", "uint256", "uint256"],
                    [await nft1155_0.PERMIT_TYPEHASH(), artist.address, alice.address, 111, deadline] //invalid nonce
                )
            ),
            artist
        );
        const { v: fv1, r: fr1, s: fs1 } = sign(
            await getDigest(
                ethers.provider,
                nft1155_0.address.toLowerCase(),
                nft1155_0.address,
                getHash(
                    ["bytes32", "address", "address", "uint256", "uint256"],
                    [await nft1155_0.PERMIT_TYPEHASH(), artist.address, alice.address, 3, deadline - 120] //deadline over
                )
            ),
            artist
        );
        const fakeSigner = ethers.Wallet.createRandom();
        const { v: fv2, r: fr2, s: fs2 } = sign(
            await getDigest(
                ethers.provider,
                nft1155_0.address.toLowerCase(),
                nft1155_0.address,
                getHash(
                    ["bytes32", "address", "address", "uint256", "uint256"],
                    [await nft1155_0.PERMIT_TYPEHASH(), artist.address, alice.address, 3, deadline] //fake signer
                )
            ),
            fakeSigner
        );

        await expect(nft1155_0.permit(artist.address, alice.address, deadline, fv0, fr0, fs0)).to.be.revertedWith(
            "SHOYU: UNAUTHORIZED"
        ); //invalid nonce
        await expect(nft1155_0.permit(artist.address, alice.address, deadline - 120, fv1, fr1, fs1)).to.be.revertedWith(
            "SHOYU: EXPIRED"
        ); //deadline over
        await expect(nft1155_0.permit(artist.address, carol.address, deadline, v1, r1, s1)).to.be.revertedWith(
            "SHOYU: UNAUTHORIZED"
        ); //wrong spender
        await expect(nft1155_0.permit(artist.address, alice.address, deadline, fv2, fr2, fs2)).to.be.revertedWith(
            "SHOYU: UNAUTHORIZED"
        ); //fake signer

        await nft1155_0.permit(artist.address, alice.address, deadline, v1, r1, s1); //wrong id
        expect(await nft1155_0.isApprovedForAll(artist.address, alice.address)).to.be.true;
    });

    it("should be that owner can only decrease royalty fee", async () => {
        const { factory, nft1155, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        await factory.deployNFT1155AndMintBatch(alice.address, [7], [10], royaltyVault.address, 20);
        const nft1155_0 = await getNFT1155(factory);

        await expect(nft1155_0.setRoyaltyFee(10)).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft1155_0.connect(alice).setRoyaltyFee(30)).to.be.revertedWith("SHOYU: INVALID_FEE");
        await nft1155_0.connect(alice).setRoyaltyFee(3);
        expect((await nft1155_0.royaltyInfo(0, 1000))[1]).to.be.equal(3);
        await nft1155_0.connect(alice).setRoyaltyFee(0);
        expect((await nft1155_0.royaltyInfo(0, 1000))[1]).to.be.equal(0);
        await expect(nft1155_0.connect(alice).setRoyaltyFee(1)).to.be.revertedWith("SHOYU: INVALID_FEE");

        await factory.deployNFT1155AndMintBatch(bob.address, [9, 11], [10, 50], royaltyVault.address, 0);
        const nft1155_1 = await getNFT1155(factory);
        expect((await nft1155_1.royaltyInfo(0, 1000))[1]).to.be.equal(0);
        await expect(nft1155_1.connect(bob).setRoyaltyFee(251)).to.be.revertedWith("SHOYU: INVALID_FEE");
        await nft1155_1.connect(bob).setRoyaltyFee(93);
        expect((await nft1155_1.royaltyInfo(0, 1000))[1]).to.be.equal(93);
        await expect(nft1155_1.connect(bob).setRoyaltyFee(111)).to.be.revertedWith("SHOYU: INVALID_FEE");
        await nft1155_1.connect(bob).setRoyaltyFee(0);
        expect((await nft1155_1.royaltyInfo(0, 1000))[1]).to.be.equal(0);
        await expect(nft1155_1.connect(bob).setRoyaltyFee(1)).to.be.revertedWith("SHOYU: INVALID_FEE");
    });

    it("should be that URI functions work well", async () => {
        const { factory, nft1155, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        async function URI1155(nft: NFT1155V3, tokenId: number, _baseURI?: string): Promise<string> {
            if (_baseURI === undefined) {
                const baseURI = await factory.baseURI1155();
                const addy = nft.address.toLowerCase();
                return toUtf8String(
                    solidityPack(["string", "string", "string"], [baseURI, addy, "/" + tokenId + ".json"])
                );
            } else {
                return toUtf8String(solidityPack(["string", "string"], [_baseURI, tokenId + ".json"]));
            }
        }

        await factory.deployNFT1155AndMintBatch(alice.address, [10], [3], royaltyVault.address, 10);
        const nft1155_0 = await getNFT1155(factory);

        await expect(nft1155_0.connect(bob).setURI(0, "https://foo.bar/0.json")).to.be.revertedWith("SHOYU: FORBIDDEN");
        await nft1155_0.connect(alice).setURI(0, "https://foo.bar/0.json");
        await nft1155_0.connect(alice).setURI(1, "https://foo.bar/1.json");

        expect(await nft1155_0.uri(0)).to.be.equal("https://foo.bar/0.json");
        expect(await nft1155_0.uri(1)).to.be.equal("https://foo.bar/1.json");

        expect(await nft1155_0.uri(2)).to.be.equal(await URI1155(nft1155_0, 2));
        expect(await nft1155_0.uri(4)).to.be.equal(await URI1155(nft1155_0, 4));
        expect(await nft1155_0.uri(7)).to.be.equal(await URI1155(nft1155_0, 7));
        expect(await nft1155_0.uri(2)).to.be.not.equal(await URI1155(nft1155_0, 2, "https://foo.bar/"));
        expect(await nft1155_0.uri(4)).to.be.not.equal(await URI1155(nft1155_0, 4, "https://foo.bar/"));
        expect(await nft1155_0.uri(7)).to.be.not.equal(await URI1155(nft1155_0, 7, "https://foo.bar/"));

        await expect(nft1155_0.connect(bob).setBaseURI("https://foo.bar/")).to.be.revertedWith("SHOYU: FORBIDDEN");
        await nft1155_0.connect(alice).setBaseURI("https://foo.bar/");

        expect(await nft1155_0.uri(2)).to.be.equal(await URI1155(nft1155_0, 2, "https://foo.bar/"));
        expect(await nft1155_0.uri(4)).to.be.equal(await URI1155(nft1155_0, 4, "https://foo.bar/"));
        expect(await nft1155_0.uri(7)).to.be.equal(await URI1155(nft1155_0, 7, "https://foo.bar/"));
        expect(await nft1155_0.uri(2)).to.be.not.equal(await URI1155(nft1155_0, 2));
        expect(await nft1155_0.uri(4)).to.be.not.equal(await URI1155(nft1155_0, 4));
        expect(await nft1155_0.uri(7)).to.be.not.equal(await URI1155(nft1155_0, 7));

        expect(await nft1155_0.contractURI()).to.be.equal(`https://foo.bar/${nft1155_0.address.toLowerCase()}.json`);
        await expect(nft1155_0.connect(bob).setContractURI("https://foo.bar/contractUri/")).to.be.revertedWith("SHOYU: FORBIDDEN");
        await nft1155_0.connect(alice).setContractURI("https://foo.bar/contractUri/");
        expect(await nft1155_0.contractURI()).to.be.equal("https://foo.bar/contractUri/");

        await factory.deployNFT1155AndMintBatch(alice.address, [10], [3], royaltyVault.address, 10);
        const nft1155_1 = await getNFT1155(factory);
        expect(await nft1155_1.contractURI()).to.be.equal(`https://nft1155.sushi.com/${nft1155_1.address.toLowerCase()}.json`);
    });

    it("should be that mint/mintBatch functions work well", async () => {
        const { factory, nft1155, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        await factory.deployNFT1155AndMintBatch(bob.address, [0, 2, 4], [5, 6, 7], royaltyVault.address, 10);
        const nft1155_0 = await getNFT1155(factory);

        await expect(nft1155_0.mint(alice.address, 1, 1, [])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft1155_0.connect(bob).mint(AddressZero, 1, 1, [])).to.be.revertedWith("SHOYU: INVALID_ADDRESS");
        await expect(nft1155_0.connect(bob).mint(factory.address, 1, 1, [])).to.be.revertedWith("SHOYU: NO_RECEIVER");

        await nft1155_0.connect(bob).mint(alice.address, 0, 100, []);
        await nft1155_0.connect(bob).mint(alice.address, 1, 100, []);

        await expect(nft1155_0.mintBatch(alice.address, [3, 5], [30, 50], [])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft1155_0.connect(bob).mintBatch(AddressZero, [3, 5], [33, 55], [])).to.be.revertedWith(
            "SHOYU: INVALID_ADDRESS"
        );

        await expect(nft1155_0.connect(bob).mintBatch(factory.address, [3, 5], [33, 55], [])).to.be.revertedWith(
            "SHOYU: NO_RECEIVER"
        );

        await nft1155_0.connect(bob).mintBatch(alice.address, [3, 5], [33, 55], []);
        await nft1155_0.connect(bob).mint(alice.address, [3, 5], [1, 3], []);
    });

    it("should be that burn/burnBatch functions work well", async () => {
        const { factory, nft1155, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        await factory.deployNFT1155AndMintBatch(bob.address, [1, 2, 4], [10, 20, 40], royaltyVault.address, 10);
        const nft1155_0 = await getNFT1155(factory);
        await nft1155_0.connect(bob).safeBatchTransferFrom(bob.address, alice.address, [1, 2, 4], [1, 2, 4], []);

        await expect(nft1155_0.connect(bob).burn(6, 1, 0, HashZero)).to.be.revertedWith("SHOYU: INSUFFICIENT_BALANCE");
        await expect(nft1155_0.connect(alice).burn(4, 5, 0, HashZero)).to.be.revertedWith(
            "SHOYU: INSUFFICIENT_BALANCE"
        );
        await nft1155_0.connect(bob).burn(4, 33, 0, HashZero);
        await expect(nft1155_0.connect(bob).burn(4, 33, 0, HashZero)).to.be.revertedWith("SHOYU: INSUFFICIENT_BALANCE");

        await nft1155_0.connect(alice).burn(4, 4, 0, HashZero);
        //alice : 1-1 2-2 4-0  _  bob : 1-9 2-18 4-3

        await expect(nft1155_0.connect(bob).burnBatch([2, 4], [10, 4])).to.be.revertedWith(
            "SHOYU: INSUFFICIENT_BALANCE"
        );
        await expect(nft1155_0.connect(bob).burnBatch([2, 8], [10, 1])).to.be.revertedWith(
            "SHOYU: INSUFFICIENT_BALANCE"
        );
        await expect(nft1155_0.connect(bob).burnBatch([4, 8], [1, 4])).to.be.revertedWith(
            "SHOYU: INSUFFICIENT_BALANCE"
        );
        await expect(nft1155_0.connect(bob).burnBatch([5, 10], [1, 1])).to.be.revertedWith(
            "SHOYU: INSUFFICIENT_BALANCE"
        );

        await nft1155_0.connect(alice).burnBatch([1, 2], [1, 2]);
        await nft1155_0.connect(bob).burnBatch([1, 2, 4], [9, 18, 3]);
    });

    it("should be that static call functions work properly", async () => {
        const { factory, nft1155, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        await factory.deployNFT1155AndMintBatch(bob.address, [1, 2, 4], [10, 20, 40], royaltyVault.address, 10);
        const nft1155_0 = await getNFT1155(factory);

        expect(await nft1155_0.target()).to.be.equal(AddressZero);
        
        const StaticCallMock = await ethers.getContractFactory("StaticCallMock");
        const target0 = (await StaticCallMock.deploy()) as StaticCallMock;

        let proxyNFT = (await StaticCallMock.attach(nft1155_0.address)) as StaticCallMock;
        await expect(proxyNFT.globalV()).to.be.reverted;
        await expect(proxyNFT.pureTest11(1)).to.be.reverted;

        await expect(nft1155_0.setTarget(target0.address)).to.be.revertedWith("SHOYU: FORBIDDEN");
        await nft1155_0.connect(bob).setTarget(target0.address);
        expect(await nft1155_0.target()).to.be.equal(target0.address);

        expect(await proxyNFT.globalV()).to.be.equal(target0.address);
        expect(await proxyNFT.pureTest11(1)).to.be.equal(1);
        expect((await proxyNFT.pureTest23(2, "abc"))[0]).to.be.equal(2);
        expect((await proxyNFT.pureTest23(2, "abc"))[1]).to.be.equal("0x0000000000000000000000000000000000000001");
        expect((await proxyNFT.pureTest23(2, "abc"))[2]).to.be.equal("abc");

        expect(await proxyNFT.viewTest11(10)).to.be.equal(0);
        await target0.setX(10, 123);
        expect(await proxyNFT.viewTest11(10)).to.be.equal(123);

        await target0.setY(11, "qwe");
        expect((await proxyNFT.viewTest13(11))[0]).to.be.equal(0);
        expect((await proxyNFT.viewTest13(11))[1]).to.be.equal(target0.address);
        expect((await proxyNFT.viewTest13(11))[2]).to.be.equal("qwe");

        await target0.setX(11, 77);
        await target0.setY(11, "zxc");
        expect((await proxyNFT.viewTest13(11))[0]).to.be.equal(77);
        expect((await proxyNFT.viewTest13(11))[1]).to.be.equal(target0.address);
        expect((await proxyNFT.viewTest13(11))[2]).to.be.equal("zxc");
    });
});

describe("Exchange part of NFT1155", () => {
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
    function name(contract: NFT1155V3): string {
        return contract.address.toLowerCase();
    }
    async function checkEvent(contract: Contract, eventName: string, args: any[]) {
        const events = await contract.queryFilter(contract.filters[eventName](), "latest");
        expect(events[0]?.event).to.be.equal(eventName);

        if (args !== undefined) {
            const length = events[0].args.length;
            expect(length).to.be.gt(0);
            for (let i = 0; i < length; i++) {
                assert.isTrue(args[i] == events[0].args[i]);
            }
        }
    }

    it("should be that the cancel function works well", async () => {
        const { factory, nft1155, royaltyVault, erc20Mock, fixedPriceSale } = await setupTest();

        const { alice, bob, carol } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        await factory.deployNFT1155AndMintBatch(alice.address, [0, 1, 2], [10, 20, 40], royaltyVault.address, 10);
        const nft1155_0 = await getNFT1155(factory);
        await nft1155_0.connect(alice).safeTransferFrom(alice.address, bob.address, 1, 10, []);
        await nft1155_0.connect(alice).safeTransferFrom(alice.address, carol.address, 2, 10, []);

        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
        const currentTime = await getBlockTimestamp();
        const deadline0 = currentTime + 100;

        const askOrder0 = await signAsk(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            alice,
            AddressZero,
            nft1155_0.address,
            0,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256"], [0, currentTime])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            bob,
            AddressZero,
            nft1155_0.address,
            1,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256"], [0, currentTime])
        );

        await expect(nft1155_0.connect(bob).cancel(askOrder0.order)).to.be.revertedWith("SHOYU: FORBIDDEN");

        await expect(nft1155_0.connect(alice).cancel(askOrder1.order)).to.be.revertedWith("SHOYU: FORBIDDEN");

        await nft1155_0.connect(alice).cancel(askOrder0.order);

        await nft1155_0.connect(bob).cancel(askOrder1.order);

        const askOrder3 = await signAsk(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            alice,
            AddressZero,
            nft1155_0.address,
            2,
            30,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        await erc20Mock.mint(bob.address, 10000);
        await erc20Mock.connect(bob).approve(nft1155_0.address, 10000);

        const fees0 = fees(11 * 50, 25, 5, 10);
        expect(await nft1155_0.balanceOf(alice.address, 2)).to.be.equal(30);
        expect(await nft1155_0.amountFilled(askOrder3.hash)).to.be.equal(0);
        await expect(() => bid2(nft1155_0, bob, askOrder3.order, 11, 50, AddressZero)).to.changeTokenBalances(
            erc20Mock,
            [bob, royaltyVault, alice],
            [-550, fees0[2], fees0[3]]
        );
        expect(await nft1155_0.amountFilled(askOrder3.hash)).to.be.equal(11);
        expect(await nft1155_0.balanceOf(alice.address, 2)).to.be.equal(19);

        await expect(nft1155_0.connect(alice).cancel(askOrder3.order)).to.emit(nft1155_0, "Cancel");
    });

    it("should be that fees are transfered properly", async () => {
        const {
            factory,
            operationalVault,
            protocolVault,
            nft1155,
            royaltyVault,
            erc20Mock,
            fixedPriceSale,
            englishAuction,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank, proxy } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        await factory.deployNFT1155AndMintBatch(
            alice.address,
            [0, 1, 2, 3],
            [100, 200, 300, 400],
            royaltyVault.address,
            10
        );
        const nft1155_0 = await getNFT1155(factory);

        await factory.setStrategyWhitelisted(englishAuction.address, true);
        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.connect(bob).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(carol).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(dan).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(erin).approve(nft1155_0.address, 10000000);

        //protocol 25 operator 5 royalty 10
        const param1 = defaultAbiCoder.encode(["uint256", "uint256"], [12345, currentTime]);
        const askOrder1 = await signAsk(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            alice,
            AddressZero,
            nft1155_0.address,
            1,
            20,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            param1
        );
        const param2 = defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime]);
        const askOrder2 = await signAsk(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            alice,
            proxy.address,
            nft1155_0.address,
            2,
            30,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            currentTime + 5,
            param2
        );
        const param3 = defaultAbiCoder.encode(["uint256", "uint256"], [15000, currentTime]);
        const askOrder3 = await signAsk(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            alice,
            AddressZero,
            nft1155_0.address,
            3,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            param3
        );

        const fees0 = fees(12345, 25, 5, 10);
        await expect(() => bid2(nft1155_0, carol, askOrder1.order, 1, 12345, AddressZero)).to.changeTokenBalances(
            erc20Mock,
            [carol, protocolVault, operationalVault, royaltyVault, alice],
            [-12345, fees0[0], fees0[1], fees0[2], fees0[3]]
        );

        await erc20Mock.connect(dan).approve(proxy.address, 10000000);
        const bidOrder2 = await signBid(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            askOrder2.hash,
            dan,
            1,
            31313,
            dan.address,
            AddressZero
        );
        const fees1 = fees(31313, 25, 5, 10);
        await expect(() => bid1(nft1155_0, proxy, askOrder2.order, bidOrder2.order)).to.changeTokenBalances(
            erc20Mock,
            [dan, protocolVault, operationalVault, royaltyVault, alice, frank, proxy],
            [-31313, fees1[0], fees1[1], fees1[2], fees1[3], 0, 0]
        );

        await factory.setProtocolFeeRecipient(erin.address);
        await factory.setOperationalFeeRecipient(frank.address);
        await factory.setOperationalFee(17);
        await nft1155_0.connect(alice).setRoyaltyFeeRecipient(carol.address);
        await nft1155_0.connect(alice).setRoyaltyFee(4);

        //erin 25/1000 frank 17/1000 carol 4/1000
        const fees2 = fees(15000, 25, 17, 4);
        await expect(() => bid2(nft1155_0, dan, askOrder3.order, 1, 15000, AddressZero)).to.changeTokenBalances(
            erc20Mock,
            [dan, erin, frank, carol, alice, protocolVault, operationalVault, royaltyVault],
            [-15000, fees2[0], fees2[1], fees2[2], fees2[3], 0, 0, 0]
        );

        await mine(100);

        await factory.deployNFT1155AndMintBatch(alice.address, [0], [10], royaltyVault.address, 0);
        const nft1155_1 = await getNFT1155(factory);

        const askOrder4 = await signAsk(
            ethers.provider,
            name(nft1155_1),
            nft1155_1.address,
            alice,
            AddressZero,
            nft1155_1.address,
            0,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline + 1000,
            defaultAbiCoder.encode(["uint256", "uint256"], [11000, currentTime])
        );

        //erin 25/1000 frank 17/1000 royalty 0/1000
        const fees4 = fees(11000, 25, 17, 0);
        await erc20Mock.connect(dan).approve(nft1155_1.address, 10000000);
        await expect(() => bid2(nft1155_1, dan, askOrder4.order, 1, 11000, AddressZero)).to.changeTokenBalances(
            erc20Mock,
            [dan, erin, frank, carol, alice, protocolVault, operationalVault, royaltyVault],
            [-11000, fees4[0], fees4[1], fees4[2], fees4[3], 0, 0, 0]
        );
        expect(fees4[2]).to.be.equal(0);
    });

    it("should be that NFT tokens can be traded on itself not others", async () => {
        const { factory, nft1155, royaltyVault, erc1155Mock, erc20Mock, fixedPriceSale } = await setupTest();

        const { alice, bob } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        await factory.deployNFT1155AndMintBatch(alice.address, [0, 1, 2, 3], [1, 2, 3, 4], royaltyVault.address, 10);
        const nft1155_0 = await getNFT1155(factory);

        await factory.deployNFT1155AndMintBatch(alice.address, [0, 1, 2, 3], [9, 8, 7, 6], royaltyVault.address, 10);
        const nft1155_1 = await getNFT1155(factory);

        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.connect(bob).approve(nft1155_0.address, 10000000);

        const askOrder0 = await signAsk(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            alice,
            AddressZero,
            nft1155_1.address,
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
            name(nft1155_0),
            nft1155_0.address,
            alice,
            AddressZero,
            erc1155Mock.address,
            0,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );

        assert.isFalse(await nft1155_0.canTrade(nft1155_1.address));
        assert.isFalse(await nft1155_0.canTrade(erc1155Mock.address));

        await expect(bid2(nft1155_0, bob, askOrder0.order, 1, 100, AddressZero)).to.be.revertedWith(
            "SHOYU: INVALID_EXCHANGE"
        );

        await expect(bid2(nft1155_0, bob, askOrder1.order, 1, 100, AddressZero)).to.be.revertedWith(
            "SHOYU: INVALID_EXCHANGE"
        );
    });

    it("should be that unfullfilled orders can be bidden again but fullfilled orders can't be bidden again", async () => {
        const {
            factory,
            nft1155,
            royaltyVault,
            erc20Mock,
            dutchAuction,
            fixedPriceSale,
            englishAuction,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank, proxy } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        await factory.deployNFT1155AndMintBatch(alice.address, [1, 2, 3], [10, 20, 30], royaltyVault.address, 10);
        const nft1155_0 = await getNFT1155(factory);

        await factory.setStrategyWhitelisted(dutchAuction.address, true);
        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
        await factory.setStrategyWhitelisted(englishAuction.address, true);
        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(bob).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(carol).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(dan).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(erin).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(frank).approve(nft1155_0.address, 10000000);

        const askOrder1 = await signAsk(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            alice,
            AddressZero,
            nft1155_0.address,
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
            name(nft1155_0),
            nft1155_0.address,
            alice,
            AddressZero,
            nft1155_0.address,
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
            name(nft1155_0),
            nft1155_0.address,
            alice,
            proxy.address,
            nft1155_0.address,
            3,
            10,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            currentTime + 5,
            defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime])
        );

        await bid2(nft1155_0, carol, askOrder1.order, 9, 990, AddressZero);
        await checkEvent(nft1155_0, "Claim", [askOrder1.hash, carol.address, 9, 990, carol.address, AddressZero]);

        await bid2(nft1155_0, dan, askOrder2.order, 9, 100, AddressZero);
        await checkEvent(nft1155_0, "Claim", [askOrder2.hash, dan.address, 9, 100, dan.address, AddressZero]);

        await erc20Mock.connect(dan).approve(proxy.address, 10000);
        const bidOrder3 = await signBid(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            askOrder3.hash,
            dan,
            9,
            101,
            dan.address,
            AddressZero
        );
        await bid1(nft1155_0, proxy, askOrder3.order, bidOrder3.order);
        await checkEvent(nft1155_0, "Claim", [askOrder3.hash, dan.address, 9, 101, dan.address, AddressZero]);

        await expect(bid2(nft1155_0, carol, askOrder1.order, 9, 999, AddressZero)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );
        await expect(bid2(nft1155_0, dan, askOrder2.order, 9, 100, AddressZero)).to.be.revertedWith("SHOYU: SOLD_OUT");

        await bid2(nft1155_0, carol, askOrder1.order, 1, 990, AddressZero);
        await checkEvent(nft1155_0, "Claim", [askOrder1.hash, carol.address, 1, 990, carol.address, AddressZero]);

        await bid2(nft1155_0, dan, askOrder2.order, 1, 100, AddressZero);
        await checkEvent(nft1155_0, "Claim", [askOrder2.hash, dan.address, 1, 100, dan.address, AddressZero]);

        await expect(bid1(nft1155_0, proxy, askOrder3.order, bidOrder3.order)).to.be.revertedWith("SHOYU: SOLD_OUT");

        await nft1155_0.connect(carol).safeTransferFrom(carol.address, alice.address, 1, 9, []);
        await expect(bid2(nft1155_0, carol, askOrder1.order, 9, 999, AddressZero)).to.be.revertedWith(
            "SHOYU: SOLD_OUT"
        );

        const bidOrder3_ = await signBid(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            askOrder3.hash,
            dan,
            1,
            131,
            dan.address,
            AddressZero
        );
        await bid1(nft1155_0, proxy, askOrder3.order, bidOrder3_.order);
        await checkEvent(nft1155_0, "Claim", [askOrder3.hash, dan.address, 1, 131, dan.address, AddressZero]);
    });

    it("should be that bid(Orders.Ask memory askOrder, Orders.Bid memory bidOrder) function works well", async () => {
        const { factory, nft1155, royaltyVault, erc20Mock, dutchAuction, fixedPriceSale } = await setupTest();

        const { alice, bob, carol, dan, erin, frank, proxy } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        await factory.deployNFT1155AndMintBatch(
            alice.address,
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
            royaltyVault.address,
            10
        );
        const nft1155_0 = await getNFT1155(factory);

        await factory.setStrategyWhitelisted(dutchAuction.address, true);
        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(bob).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(carol).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(dan).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(erin).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(frank).approve(nft1155_0.address, 10000000);

        const askOrder1 = await signAsk(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            alice,
            AddressZero,
            nft1155_0.address,
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
            name(nft1155_0),
            nft1155_0.address,
            alice,
            AddressZero,
            nft1155_0.address,
            2,
            3,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime])
        );

        await erc20Mock.connect(dan).approve(proxy.address, 1000);

        const bidOrder1 = await signBid(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            askOrder1.hash,
            carol,
            4,
            990,
            AddressZero,
            AddressZero
        );
        const bidOrder2 = await signBid(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            askOrder2.hash,
            dan,
            3,
            100,
            AddressZero,
            AddressZero
        );

        await bid1(nft1155_0, bob, askOrder1.order, bidOrder1.order);
        await checkEvent(nft1155_0, "Claim", [askOrder1.hash, carol.address, 4, 990, carol.address, AddressZero]);

        await bid1(nft1155_0, alice, askOrder2.order, bidOrder2.order);
        await checkEvent(nft1155_0, "Claim", [askOrder2.hash, dan.address, 3, 100, dan.address, AddressZero]);
    });

    it("should be that fees and nft go to recipients if they are set in orders", async () => {
        const {
            factory,
            operationalVault,
            protocolVault,
            nft1155,
            royaltyVault,
            erc20Mock,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol, dan, frank } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        await factory.deployNFT1155AndMintBatch(alice.address, [0, 1], [10, 11], royaltyVault.address, 10);
        const nft1155_0 = await getNFT1155(factory);

        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.connect(bob).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(carol).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(dan).approve(nft1155_0.address, 10000000);

        //protocol 25 operator 5 royalty 10
        const fees0 = fees(12345 * 3, 25, 5, 10);
        const askOrder1 = await signAsk(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            alice,
            AddressZero,
            nft1155_0.address,
            1,
            5,
            fixedPriceSale.address,
            erc20Mock.address,
            frank.address,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [12345, currentTime])
        );

        await expect(() => bid2(nft1155_0, carol, askOrder1.order, 3, 12345, bob.address)).to.changeTokenBalances(
            erc20Mock,
            [carol, protocolVault, operationalVault, royaltyVault, frank, alice],
            [-12345 * 3, fees0[0], fees0[1], fees0[2], fees0[3], 0]
        );
        expect(await nft1155_0.balanceOf(carol.address, 1)).to.be.equal(0);
        expect(await nft1155_0.balanceOf(bob.address, 1)).to.be.equal(3);
    });

    it("should be that bid and claim functions work properly with proxy", async () => {
        const { factory, nft1155, royaltyVault, erc20Mock, dutchAuction, fixedPriceSale } = await setupTest();

        const { alice, bob, dan, erin, frank, proxy } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        await factory.deployNFT1155AndMintBatch(
            alice.address,
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
            royaltyVault.address,
            10
        );
        const nft1155_0 = await getNFT1155(factory);

        await factory.setStrategyWhitelisted(dutchAuction.address, true);
        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(dan).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(erin).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(frank).approve(nft1155_0.address, 10000000);

        const askOrderFwithP = await signAsk(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            alice,
            proxy.address,
            nft1155_0.address,
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
            name(nft1155_0),
            nft1155_0.address,
            alice,
            AddressZero,
            nft1155_0.address,
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
            name(nft1155_0),
            nft1155_0.address,
            alice,
            proxy.address,
            nft1155_0.address,
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
            name(nft1155_0),
            nft1155_0.address,
            alice,
            AddressZero,
            nft1155_0.address,
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
            name(nft1155_0),
            nft1155_0.address,
            askOrderFwithP.hash,
            erin,
            3,
            200,
            AddressZero,
            AddressZero
        );
        const bidOrderFwithoutP = await signBid(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            askOrderFwithoutP.hash,
            erin,
            4,
            201,
            AddressZero,
            AddressZero
        );

        await expect(bid1(nft1155_0, bob, askOrderFwithP.order, bidOrderFwithP.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );
        await bid1(nft1155_0, proxy, askOrderFwithP.order, bidOrderFwithP.order);
        await checkEvent(nft1155_0, "Claim", [askOrderFwithP.hash, erin.address, 3, 200, erin.address, AddressZero]);

        await bid1(nft1155_0, bob, askOrderFwithoutP.order, bidOrderFwithoutP.order);
        await checkEvent(nft1155_0, "Claim", [askOrderFwithoutP.hash, erin.address, 4, 201, erin.address, AddressZero]);
        expect(await nft1155_0.balanceOf(erin.address, 2)).to.be.equal(3);
        expect(await nft1155_0.balanceOf(erin.address, 3)).to.be.equal(4);

        const bidOrderDwithP = await signBid(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            askOrderDwithP.hash,
            frank,
            2,
            990,
            AddressZero,
            AddressZero
        );
        const bidOrderDwithoutP = await signBid(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            askOrderDwithoutP.hash,
            frank,
            3,
            980,
            AddressZero,
            AddressZero
        );

        await expect(bid1(nft1155_0, bob, askOrderDwithP.order, bidOrderDwithP.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );
        await bid1(nft1155_0, proxy, askOrderDwithP.order, bidOrderDwithP.order);
        await checkEvent(nft1155_0, "Claim", [askOrderDwithP.hash, frank.address, 2, 990, frank.address, AddressZero]);

        await bid1(nft1155_0, bob, askOrderDwithoutP.order, bidOrderDwithoutP.order);
        await checkEvent(nft1155_0, "Claim", [
            askOrderDwithoutP.hash,
            frank.address,
            3,
            980,
            frank.address,
            AddressZero,
        ]);
        expect(await nft1155_0.balanceOf(frank.address, 4)).to.be.equal(2);
        expect(await nft1155_0.balanceOf(frank.address, 5)).to.be.equal(3);

        const askOrderFwithP1 = await signAsk(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            alice,
            proxy.address,
            nft1155_0.address,
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
            name(nft1155_0),
            nft1155_0.address,
            alice,
            AddressZero,
            nft1155_0.address,
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
            name(nft1155_0),
            nft1155_0.address,
            alice,
            proxy.address,
            nft1155_0.address,
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
            name(nft1155_0),
            nft1155_0.address,
            alice,
            AddressZero,
            nft1155_0.address,
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
            name(nft1155_0),
            nft1155_0.address,
            askOrderFwithP1.hash,
            erin,
            3,
            200,
            AddressZero,
            AddressZero
        );
        const bidOrderFwithoutP1 = await signBid(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            askOrderFwithoutP1.hash,
            erin,
            4,
            201,
            AddressZero,
            AddressZero
        );

        await bid1(nft1155_0, proxy, askOrderFwithP1.order, bidOrderFwithP1.order);
        await checkEvent(nft1155_0, "Claim", [askOrderFwithP1.hash, erin.address, 3, 200, erin.address, AddressZero]);
        await expect(bid1(nft1155_0, bob, askOrderFwithoutP1.order, bidOrderFwithoutP1.order)).to.be.revertedWith(
            "SHOYU: FAILURE"
        );

        const bidOrderDwithP1 = await signBid(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            askOrderDwithP1.hash,
            frank,
            5,
            990,
            AddressZero,
            AddressZero
        );
        const bidOrderDwithoutP1 = await signBid(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            askOrderDwithoutP1.hash,
            frank,
            6,
            980,
            AddressZero,
            AddressZero
        );

        await bid1(nft1155_0, proxy, askOrderDwithP1.order, bidOrderDwithP1.order);
        await checkEvent(nft1155_0, "Claim", [askOrderDwithP1.hash, frank.address, 5, 990, frank.address, AddressZero]);
        await expect(bid1(nft1155_0, bob, askOrderDwithoutP1.order, bidOrderDwithoutP1.order)).to.be.revertedWith(
            "SHOYU: FAILURE"
        );
    });

    it("should be that bid and claim functions work properly with _bidHashes", async () => {
        const { factory, nft1155, royaltyVault, erc20Mock, dutchAuction, fixedPriceSale } = await setupTest();

        const { alice, carol, dan, erin, frank, proxy } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        await factory.deployNFT1155AndMintBatch(
            alice.address,
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
            [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
            royaltyVault.address,
            10
        );
        const nft1155_0 = await getNFT1155(factory);

        await factory.setStrategyWhitelisted(dutchAuction.address, true);
        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(dan).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(erin).approve(nft1155_0.address, 10000000);
        await erc20Mock.connect(frank).approve(nft1155_0.address, 10000000);

        const askOrderF0 = await signAsk(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            alice,
            proxy.address,
            nft1155_0.address,
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
            name(nft1155_0),
            nft1155_0.address,
            alice,
            proxy.address,
            nft1155_0.address,
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
            name(nft1155_0),
            nft1155_0.address,
            alice,
            proxy.address,
            nft1155_0.address,
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
            name(nft1155_0),
            nft1155_0.address,
            askOrderF0.hash,
            erin,
            3,
            200,
            AddressZero,
            AddressZero
        );
        const bidOrderF1 = await signBid(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            askOrderF1.hash,
            erin,
            4,
            201,
            AddressZero,
            AddressZero
        );

        expect(await nft1155_0.approvedBidHash(proxy.address, askOrderF0.hash, erin.address)).to.be.equal(HashZero);
        await expect(nft1155_0.connect(proxy).updateApprovedBidHash(askOrderF0.hash, erin.address, bidOrderF0.hash))
            .to.emit(nft1155_0, "UpdateApprovedBidHash")
            .withArgs(proxy.address, askOrderF0.hash, erin.address, bidOrderF0.hash);
        expect(await nft1155_0.approvedBidHash(proxy.address, askOrderF0.hash, erin.address)).to.be.equal(
            bidOrderF0.hash
        );

        await expect(
            bid2(
                nft1155_0,
                erin,
                askOrderF0.order,
                bidOrderF0.order.amount,
                bidOrderF0.order.price,
                bidOrderF0.order.recipient
            )
        ).to.be.revertedWith("SHOYU: FORBIDDEN");

        await expect(nft1155_0.connect(carol).claim(askOrderF0.order)).to.be.revertedWith("SHOYU: FAILURE");
        await bid1(nft1155_0, frank, askOrderF0.order, bidOrderF0.order); //frank can call
        await checkEvent(nft1155_0, "Claim", [askOrderF0.hash, erin.address, 3, 200, erin.address, AddressZero]);
        expect(await nft1155_0.approvedBidHash(proxy.address, askOrderF0.hash, erin.address)).to.be.equal(HashZero);

        const bidOrderF1_ = await signBid(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            askOrderF1.hash,
            erin,
            9,
            201,
            AddressZero,
            AddressZero
        );
        await nft1155_0.connect(erin).updateApprovedBidHash(askOrderF1.hash, erin.address, bidOrderF1_.hash); //make fake hash for abusing
        expect(await nft1155_0.approvedBidHash(erin.address, askOrderF1.hash, erin.address)).to.be.equal(
            bidOrderF1_.hash
        );
        expect(await nft1155_0.approvedBidHash(proxy.address, askOrderF1.hash, erin.address)).to.be.equal(HashZero);
        await expect(bid1(nft1155_0, erin, askOrderF1.order, bidOrderF1_.order)).to.be.revertedWith("SHOYU: FORBIDDEN");

        await mine(100);
        expect(await getBlockTimestamp()).to.be.gt(askOrderF1.order.deadline);
        await nft1155_0.connect(proxy).updateApprovedBidHash(askOrderF1.hash, erin.address, bidOrderF1.hash); //timeover but update available
        expect(await nft1155_0.approvedBidHash(proxy.address, askOrderF1.hash, erin.address)).to.be.equal(
            bidOrderF1.hash
        );

        const bidOrderF1__ = await signBid(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            askOrderF1.hash,
            erin,
            3,
            201,
            AddressZero,
            AddressZero
        ); //change conditions after hash approved
        await expect(bid1(nft1155_0, erin, askOrderF1.order, bidOrderF1__.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );

        await bid1(nft1155_0, erin, askOrderF1.order, bidOrderF1.order);
        await checkEvent(nft1155_0, "Claim", [askOrderF1.hash, erin.address, 4, 201, erin.address, AddressZero]);
        expect(await nft1155_0.approvedBidHash(proxy.address, askOrderF1.hash, erin.address)).to.be.equal(HashZero);
        expect(await nft1155_0.balanceOf(erin.address, 2)).to.be.equal(3);
        expect(await nft1155_0.balanceOf(erin.address, 3)).to.be.equal(4);

        const bidOrderD0 = await signBid(
            ethers.provider,
            name(nft1155_0),
            nft1155_0.address,
            askOrderD0.hash,
            frank,
            2,
            990,
            AddressZero,
            AddressZero
        );

        expect(await getBlockTimestamp()).to.be.gt(askOrderD0.order.deadline);
        await nft1155_0.connect(proxy).updateApprovedBidHash(askOrderD0.hash, frank.address, bidOrderD0.hash); //timeover but update available
        expect(await nft1155_0.approvedBidHash(proxy.address, askOrderD0.hash, frank.address)).to.be.equal(
            bidOrderD0.hash
        );

        await bid1(nft1155_0, frank, askOrderD0.order, bidOrderD0.order);
        await checkEvent(nft1155_0, "Claim", [askOrderD0.hash, frank.address, 2, 990, frank.address, AddressZero]);
        expect(await nft1155_0.approvedBidHash(proxy.address, askOrderD0.hash, frank.address)).to.be.equal(HashZero);
        expect(await nft1155_0.balanceOf(frank.address, 4)).to.be.equal(2);
    });
});
