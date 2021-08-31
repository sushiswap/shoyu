import {
    TokenFactory,
    NFT1155V0,
    ERC1155Mock,
    ERC20Mock,
    EnglishAuction,
    DutchAuction,
    FixedPriceSale,
    DesignatedSale,
    ExchangeProxy,
} from "../typechain";

import { sign, convertToHash, domainSeparator, getDigest, getHash, signAsk, signBid } from "./utils/sign-utils";
import { ethers } from "hardhat";
import { BigNumber, BigNumberish, BytesLike, Wallet } from "ethers";
import { expect, assert } from "chai";
import { solidityPack, toUtf8String, defaultAbiCoder } from "ethers/lib/utils";
import { getBlock, mine } from "./utils/blocks";

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

    const NFT1155Contract = await ethers.getContractFactory("NFT1155V0");
    const nft1155 = (await NFT1155Contract.deploy()) as NFT1155V0;

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

    const DesignatedSale = await ethers.getContractFactory("DesignatedSale");
    const designatedSale = (await DesignatedSale.deploy()) as DesignatedSale;

    const ExchangeProxy = await ethers.getContractFactory("ExchangeProxy");
    const exchangeProxy = (await ExchangeProxy.deploy()) as ExchangeProxy;

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
        designatedSale,
        exchangeProxy,
    };
};

async function getNFT1155(factory: TokenFactory): Promise<NFT1155V0> {
    const events = await factory.queryFilter(factory.filters.DeployNFT1155AndMintBatch(), "latest");
    const NFT1155Contract = await ethers.getContractFactory("NFT1155V0");
    return (await NFT1155Contract.attach(events[0].args[0])) as NFT1155V0;
}

describe.only("NFT part of NFT1155", () => {
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

        async function URI1155(nft: NFT1155V0, tokenId: number): Promise<string> {
            const baseURI = await factory.baseURI1155();
            const addy = nft.address.toLowerCase();
            return toUtf8String(
                solidityPack(
                    ["string", "string", "string", "string", "string"],
                    [baseURI, addy, "/", tokenId.toString(), ".json"]
                )
            );
        }

        expect(await nft1155_0.uri(0)).to.be.equal(await URI1155(nft1155_0, 0));
        expect(await nft1155_0.uri(2)).to.be.equal(await URI1155(nft1155_0, 2));
        expect(await nft1155_0.uri(4)).to.be.equal(await URI1155(nft1155_0, 4));
        expect(await nft1155_0.uri(1)).to.be.equal(await URI1155(nft1155_0, 1));
        expect(await nft1155_0.uri(11759)).to.be.equal(await URI1155(nft1155_0, 11759));

        expect((await nft1155_0.royaltyFeeInfo())[0]).to.be.equal(royaltyVault.address);
        expect((await nft1155_0.royaltyInfo(0, 0))[0]).to.be.equal(royaltyVault.address);

        expect((await nft1155_0.royaltyFeeInfo())[1]).to.be.equal(13);
        expect((await nft1155_0.royaltyInfo(0, 12345))[1]).to.be.equal(Math.floor((12345 * 13) / 1000));
    });

    it("should be that permit fuctions work well", async () => {
        const { factory, nft1155, alice, bob, carol, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        const artist = ethers.Wallet.createRandom();

        await factory.deployNFT1155AndMintBatch(artist.address, [0, 1, 2], [5, 6, 7], royaltyVault.address, 10);
        const nft1155_0 = await getNFT1155(factory);

        const currentTime = Math.floor(+new Date() / 1000);
        let deadline = currentTime + 100;
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
        expect((await nft1155_0.royaltyFeeInfo())[1]).to.be.equal(3);
        await nft1155_0.connect(alice).setRoyaltyFee(0);
        expect((await nft1155_0.royaltyFeeInfo())[1]).to.be.equal(0);
        await expect(nft1155_0.connect(alice).setRoyaltyFee(1)).to.be.revertedWith("SHOYU: INVALID_FEE");

        await factory.deployNFT1155AndMintBatch(bob.address, [9, 11], [10, 50], royaltyVault.address, 0);
        const nft1155_1 = await getNFT1155(factory);
        expect((await nft1155_1.royaltyFeeInfo())[1]).to.be.equal(255);
        await expect(nft1155_1.connect(bob).setRoyaltyFee(251)).to.be.revertedWith("SHOYU: INVALID_FEE");
        await nft1155_1.connect(bob).setRoyaltyFee(93);
        expect((await nft1155_1.royaltyFeeInfo())[1]).to.be.equal(93);
        await expect(nft1155_1.connect(bob).setRoyaltyFee(111)).to.be.revertedWith("SHOYU: INVALID_FEE");
        await nft1155_1.connect(bob).setRoyaltyFee(0);
        expect((await nft1155_1.royaltyFeeInfo())[1]).to.be.equal(0);
        await expect(nft1155_1.connect(bob).setRoyaltyFee(1)).to.be.revertedWith("SHOYU: INVALID_FEE");
    });

    it("should be that URI functions work well", async () => {
        const { factory, nft1155, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT1155(nft1155.address);

        async function URI1155(nft: NFT1155V0, tokenId: number, _baseURI?: string): Promise<string> {
            if (_baseURI === undefined) {
                const baseURI = await factory.baseURI1155();
                const addy = nft.address.toLowerCase();
                return toUtf8String(
                    solidityPack(
                        ["string", "string", "string", "string", "string"],
                        [baseURI, addy, "/", tokenId.toString(), ".json"]
                    )
                );
            } else {
                return toUtf8String(
                    solidityPack(["string", "string", "string"], [_baseURI, tokenId.toString(), ".json"])
                );
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
});

// describe("Exchange part of NFT1155", () => {
//     beforeEach(async () => {
//         await ethers.provider.send("hardhat_reset", []);
//     });
//     function getWallets() {
//         const alice = Wallet.fromMnemonic(
//             "test test test test test test test test test test test junk",
//             "m/44'/60'/0'/0/3"
//         ).connect(ethers.provider);
//         const bob = Wallet.fromMnemonic(
//             "test test test test test test test test test test test junk",
//             "m/44'/60'/0'/0/4"
//         ).connect(ethers.provider);
//         const carol = Wallet.fromMnemonic(
//             "test test test test test test test test test test test junk",
//             "m/44'/60'/0'/0/5"
//         ).connect(ethers.provider);
//         const dan = Wallet.fromMnemonic(
//             "test test test test test test test test test test test junk",
//             "m/44'/60'/0'/0/7"
//         ).connect(ethers.provider);
//         const erin = Wallet.fromMnemonic(
//             "test test test test test test test test test test test junk",
//             "m/44'/60'/0'/0/8"
//         ).connect(ethers.provider);
//         const frank = Wallet.fromMnemonic(
//             "test test test test test test test test test test test junk",
//             "m/44'/60'/0'/0/9"
//         ).connect(ethers.provider);

//         return { alice, bob, carol, dan, erin, frank };
//     }
//     function fees(price: BigNumberish, protocol: number, operator: number, royalty: number): BigNumberish[] {
//         assert.isBelow(protocol, 255);
//         assert.isBelow(operator, 255);
//         assert.isBelow(royalty, 255);

//         const fee: BigNumberish[] = [];

//         const p = BigNumber.from(price).mul(protocol).div(1000);
//         const o = BigNumber.from(price).mul(operator).div(1000);
//         const r = BigNumber.from(price).sub(p.add(o)).mul(royalty).div(1000);
//         const seller = BigNumber.from(price).sub(p.add(o).add(r));

//         fee.push(p);
//         fee.push(o);
//         fee.push(r);
//         fee.push(seller);

//         return fee;
//     }

//     it("should be that the cancel function works well", async () => {
//         const { factory, nft1155, royaltyVault, erc20Mock, englishAuction } = await setupTest();

//         const { alice, bob, carol } = getWallets();

//         await factory.setDeployerWhitelisted(AddressZero, true);
//         await factory.upgradeNFT1155(nft1155.address);

//         await factory.deployNFT1155AndMintBatch(alice.address, "Name", "Symbol", [0, 1, 2], royaltyVault.address, 10);
//         const nft1155_0 = await getNFT1155(factory);
//         await nft1155_0.connect(alice).transferFrom(alice.address, bob.address, 1);
//         await nft1155_0.connect(alice).transferFrom(alice.address, carol.address, 2);

//         await factory.setStrategyWhitelisted(englishAuction.address, true);
//         const currentBlock = await getBlock();
//         const deadline0 = currentBlock + 100;
//         expect(await nft1155_0.ownerOf(0)).to.be.equal(alice.address);
//         const askOrder0 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             0,
//             1,
//             englishAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline0,
//             "0x"
//         );
//         const askOrder1 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             bob,
//             nft1155_0.address,
//             1,
//             1,
//             englishAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline0,
//             "0x"
//         );

//         await expect(
//             nft1155_0.connect(bob).cancel({
//                 signer: alice.address,
//                 token: nft1155_0.address,
//                 tokenId: 0,
//                 amount: 1,
//                 strategy: englishAuction.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline0,
//                 params: "0x",
//                 v: askOrder0.sig.v,
//                 r: askOrder0.sig.r,
//                 s: askOrder0.sig.s,
//             })
//         ).to.be.revertedWith("SHOYU: FORBIDDEN");

//         await expect(
//             nft1155_0.connect(alice).cancel({
//                 signer: bob.address,
//                 token: nft1155_0.address,
//                 tokenId: 1,
//                 amount: 1,
//                 strategy: englishAuction.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline0,
//                 params: "0x",
//                 v: askOrder1.sig.v,
//                 r: askOrder1.sig.r,
//                 s: askOrder1.sig.s,
//             })
//         ).to.be.revertedWith("SHOYU: FORBIDDEN");

//         expect(
//             await nft1155_0.connect(alice).cancel({
//                 signer: alice.address,
//                 token: nft1155_0.address,
//                 tokenId: 0,
//                 amount: 1,
//                 strategy: englishAuction.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline0,
//                 params: "0x",
//                 v: askOrder0.sig.v,
//                 r: askOrder0.sig.r,
//                 s: askOrder0.sig.s,
//             })
//         );

//         expect(
//             await nft1155_0.connect(bob).cancel({
//                 signer: bob.address,
//                 token: nft1155_0.address,
//                 tokenId: 1,
//                 amount: 1,
//                 strategy: englishAuction.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline0,
//                 params: "0x",
//                 v: askOrder1.sig.v,
//                 r: askOrder1.sig.r,
//                 s: askOrder1.sig.s,
//             })
//         );

//         const askOrder2 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             carol,
//             nft1155_0.address,
//             2,
//             1,
//             englishAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline0,
//             defaultAbiCoder.encode(["uint256"], [50])
//         );

//         expect((await nft1155_0.bestBid(askOrder2.hash))[0]).to.be.equal(AddressZero);
//         await nft1155_0
//             .connect(bob)
//             [
//                 "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//             ](
//                 {
//                     signer: carol.address,
//                     token: nft1155_0.address,
//                     tokenId: 2,
//                     amount: 1,
//                     strategy: englishAuction.address,
//                     currency: erc20Mock.address,
//                     recipient: AddressZero,
//                     deadline: deadline0,
//                     params: defaultAbiCoder.encode(["uint256"], [50]),
//                     v: askOrder2.sig.v,
//                     r: askOrder2.sig.r,
//                     s: askOrder2.sig.s,
//                 },
//                 1,
//                 100,
//                 AddressZero,
//                 AddressZero
//             );

//         expect((await nft1155_0.bestBid(askOrder2.hash))[0]).to.be.equal(bob.address);

//         await expect(
//             nft1155_0.connect(carol).cancel({
//                 signer: carol.address,
//                 token: nft1155_0.address,
//                 tokenId: 2,
//                 amount: 1,
//                 strategy: englishAuction.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline0,
//                 params: defaultAbiCoder.encode(["uint256"], [50]),
//                 v: askOrder2.sig.v,
//                 r: askOrder2.sig.r,
//                 s: askOrder2.sig.s,
//             })
//         ).to.be.revertedWith("SHOYU: BID_EXISTS");
//     });

//     it("should be that the claim function can be called by anyone", async () => {
//         const { factory, nft1155, royaltyVault, erc20Mock, englishAuction } = await setupTest();

//         const { alice, bob, carol, dan } = getWallets();

//         await factory.setDeployerWhitelisted(AddressZero, true);
//         await factory.upgradeNFT1155(nft1155.address);

//         await factory.deployNFT1155AndMintBatch(alice.address, "Name", "Symbol", [0, 1, 2], royaltyVault.address, 10);
//         const nft1155_0 = await getNFT1155(factory);
//         await nft1155_0.connect(alice).transferFrom(alice.address, bob.address, 1);

//         await factory.setStrategyWhitelisted(englishAuction.address, true);
//         const currentBlock = await getBlock();
//         const deadline0 = currentBlock + 100;
//         expect(await nft1155_0.ownerOf(0)).to.be.equal(alice.address);

//         await erc20Mock.mint(carol.address, 10000);
//         await erc20Mock.mint(dan.address, 10000);
//         await erc20Mock.connect(carol).approve(nft1155_0.address, 10000);
//         await erc20Mock.connect(dan).approve(nft1155_0.address, 10000);

//         const askOrder0 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             0,
//             1,
//             englishAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline0,
//             defaultAbiCoder.encode(["uint256"], [50])
//         );
//         const askOrder1 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             bob,
//             nft1155_0.address,
//             1,
//             1,
//             englishAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline0,
//             defaultAbiCoder.encode(["uint256"], [50])
//         );
//         const askOrder2 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             2,
//             1,
//             englishAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline0,
//             defaultAbiCoder.encode(["uint256"], [50])
//         );

//         await nft1155_0
//             .connect(carol)
//             [
//                 "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//             ](
//                 {
//                     signer: alice.address,
//                     token: nft1155_0.address,
//                     tokenId: 0,
//                     amount: 1,
//                     strategy: englishAuction.address,
//                     currency: erc20Mock.address,
//                     recipient: AddressZero,
//                     deadline: deadline0,
//                     params: defaultAbiCoder.encode(["uint256"], [50]),
//                     v: askOrder0.sig.v,
//                     r: askOrder0.sig.r,
//                     s: askOrder0.sig.s,
//                 },
//                 1,
//                 100,
//                 AddressZero,
//                 AddressZero
//             );
//         expect((await nft1155_0.bestBid(askOrder0.hash))[0]).to.be.equal(carol.address);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[2]).to.be.equal(100);

//         await nft1155_0
//             .connect(dan)
//             [
//                 "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//             ](
//                 {
//                     signer: bob.address,
//                     token: nft1155_0.address,
//                     tokenId: 1,
//                     amount: 1,
//                     strategy: englishAuction.address,
//                     currency: erc20Mock.address,
//                     recipient: AddressZero,
//                     deadline: deadline0,
//                     params: defaultAbiCoder.encode(["uint256"], [50]),
//                     v: askOrder1.sig.v,
//                     r: askOrder1.sig.r,
//                     s: askOrder1.sig.s,
//                 },
//                 1,
//                 300,
//                 AddressZero,
//                 AddressZero
//             );
//         expect((await nft1155_0.bestBid(askOrder1.hash))[0]).to.be.equal(dan.address);
//         expect((await nft1155_0.bestBid(askOrder1.hash))[2]).to.be.equal(300);

//         await nft1155_0
//             .connect(dan)
//             [
//                 "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//             ](
//                 {
//                     signer: alice.address,
//                     token: nft1155_0.address,
//                     tokenId: 2,
//                     amount: 1,
//                     strategy: englishAuction.address,
//                     currency: erc20Mock.address,
//                     recipient: AddressZero,
//                     deadline: deadline0,
//                     params: defaultAbiCoder.encode(["uint256"], [50]),
//                     v: askOrder2.sig.v,
//                     r: askOrder2.sig.r,
//                     s: askOrder2.sig.s,
//                 },
//                 1,
//                 500,
//                 AddressZero,
//                 AddressZero
//             );
//         expect((await nft1155_0.bestBid(askOrder2.hash))[0]).to.be.equal(dan.address);
//         expect((await nft1155_0.bestBid(askOrder2.hash))[2]).to.be.equal(500);

//         await mine(100);
//         assert.isTrue(deadline0 < (await getBlock()));

//         //nft0 : seller-Alice / buyer-Carol. Dan can claim.
//         expect(
//             await nft1155_0.connect(dan).claim({
//                 signer: alice.address,
//                 token: nft1155_0.address,
//                 tokenId: 0,
//                 amount: 1,
//                 strategy: englishAuction.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline0,
//                 params: defaultAbiCoder.encode(["uint256"], [50]),
//                 v: askOrder0.sig.v,
//                 r: askOrder0.sig.r,
//                 s: askOrder0.sig.s,
//             })
//         ).to.emit(nft1155_0, "Claim");
//         expect(await nft1155_0.ownerOf(0)).to.be.equal(carol.address);
//         expect(await erc20Mock.balanceOf(carol.address)).to.be.equal(9900);

//         //nft1 : seller-Bob / buyer-Dan.  Seller Bob can claim.
//         expect(
//             await nft1155_0.connect(bob).claim({
//                 signer: bob.address,
//                 token: nft1155_0.address,
//                 tokenId: 1,
//                 amount: 1,
//                 strategy: englishAuction.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline0,
//                 params: defaultAbiCoder.encode(["uint256"], [50]),
//                 v: askOrder1.sig.v,
//                 r: askOrder1.sig.r,
//                 s: askOrder1.sig.s,
//             })
//         ).to.emit(nft1155_0, "Claim");
//         expect(await nft1155_0.ownerOf(1)).to.be.equal(dan.address);
//         expect(await erc20Mock.balanceOf(dan.address)).to.be.equal(9700);

//         //nft2 : seller-Alice / buyer-Dan.  Buyer Dan can claim.
//         expect(
//             await nft1155_0.connect(dan).claim({
//                 signer: alice.address,
//                 token: nft1155_0.address,
//                 tokenId: 2,
//                 amount: 1,
//                 strategy: englishAuction.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline0,
//                 params: defaultAbiCoder.encode(["uint256"], [50]),
//                 v: askOrder2.sig.v,
//                 r: askOrder2.sig.r,
//                 s: askOrder2.sig.s,
//             })
//         ).to.emit(nft1155_0, "Claim");
//         expect((await nft1155_0.bestBid(askOrder2.hash))[0]).to.be.equal(AddressZero);
//         expect(await nft1155_0.ownerOf(2)).to.be.equal(dan.address);
//         expect(await erc20Mock.balanceOf(dan.address)).to.be.equal(9200);
//     });

//     it("should be that the claim function will be reverted if BestBid is not exist", async () => {
//         const {
//             factory,
//             nft1155,
//             royaltyVault,
//             erc20Mock,
//             englishAuction,
//             dutchAuction,
//             fixedPriceSale,
//             designatedSale,
//             exchangeProxy,
//         } = await setupTest();

//         const { alice } = getWallets();

//         await factory.setDeployerWhitelisted(AddressZero, true);
//         await factory.upgradeNFT1155(nft1155.address);

//         await factory.deployNFT1155AndMintBatch(
//             alice.address,
//             "Name",
//             "Symbol",
//             [0, 1, 2, 3],
//             royaltyVault.address,
//             10
//         );
//         const nft1155_0 = await getNFT1155(factory);

//         await factory.setStrategyWhitelisted(englishAuction.address, true);
//         await factory.setStrategyWhitelisted(dutchAuction.address, true);
//         await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
//         await factory.setStrategyWhitelisted(designatedSale.address, true);

//         const currentBlock = await getBlock();
//         const deadline0 = currentBlock + 100;
//         const askOrder0 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             0,
//             1,
//             englishAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline0,
//             defaultAbiCoder.encode(["uint256"], [50])
//         );
//         const askOrder1 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             1,
//             1,
//             dutchAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline0,
//             defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentBlock])
//         );
//         const askOrder2 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             2,
//             1,
//             fixedPriceSale.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline0,
//             defaultAbiCoder.encode(["uint256"], [100])
//         );
//         const askOrder3 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             3,
//             1,
//             designatedSale.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline0,
//             defaultAbiCoder.encode(["uint256", "address"], [100, exchangeProxy.address])
//         );

//         expect((await nft1155_0.bestBid(askOrder0.hash))[0]).to.be.equal(AddressZero);
//         expect((await nft1155_0.bestBid(askOrder1.hash))[0]).to.be.equal(AddressZero);
//         expect((await nft1155_0.bestBid(askOrder2.hash))[0]).to.be.equal(AddressZero);
//         expect((await nft1155_0.bestBid(askOrder3.hash))[0]).to.be.equal(AddressZero);

//         await expect(
//             nft1155_0.claim({
//                 signer: alice.address,
//                 token: nft1155_0.address,
//                 tokenId: 3,
//                 amount: 1,
//                 strategy: designatedSale.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline0,
//                 params: defaultAbiCoder.encode(["uint256", "address"], [100, exchangeProxy.address]),
//                 v: askOrder3.sig.v,
//                 r: askOrder3.sig.r,
//                 s: askOrder3.sig.s,
//             })
//         ).to.be.revertedWith("SHOYU: FAILURE");

//         await expect(
//             nft1155_0.claim({
//                 signer: alice.address,
//                 token: nft1155_0.address,
//                 tokenId: 2,
//                 amount: 1,
//                 strategy: fixedPriceSale.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline0,
//                 params: defaultAbiCoder.encode(["uint256"], [100]),
//                 v: askOrder2.sig.v,
//                 r: askOrder2.sig.r,
//                 s: askOrder2.sig.s,
//             })
//         ).to.be.revertedWith("SHOYU: FAILURE");

//         await expect(
//             nft1155_0.claim({
//                 signer: alice.address,
//                 token: nft1155_0.address,
//                 tokenId: 1,
//                 amount: 1,
//                 strategy: dutchAuction.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline0,
//                 params: defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentBlock]),
//                 v: askOrder1.sig.v,
//                 r: askOrder1.sig.r,
//                 s: askOrder1.sig.s,
//             })
//         ).to.be.revertedWith("SHOYU: FAILURE");

//         await expect(
//             nft1155_0.claim({
//                 signer: alice.address,
//                 token: nft1155_0.address,
//                 tokenId: 0,
//                 amount: 1,
//                 strategy: englishAuction.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline0,
//                 params: defaultAbiCoder.encode(["uint256"], [50]),
//                 v: askOrder0.sig.v,
//                 r: askOrder0.sig.r,
//                 s: askOrder0.sig.s,
//             })
//         ).to.be.revertedWith("SHOYU: FAILURE");
//         assert.isFalse(deadline0 < (await getBlock()));
//         assert.isFalse(await nft1155_0.isCancelledOrClaimed(askOrder0.hash));
//         expect(await nft1155_0.ownerOf(0)).to.be.equal(alice.address);

//         await mine(100);
//         assert.isTrue(deadline0 < (await getBlock()));
//         await expect(
//             nft1155_0.claim({
//                 signer: alice.address,
//                 token: nft1155_0.address,
//                 tokenId: 0,
//                 amount: 1,
//                 strategy: englishAuction.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline0,
//                 params: defaultAbiCoder.encode(["uint256"], [50]),
//                 v: askOrder0.sig.v,
//                 r: askOrder0.sig.r,
//                 s: askOrder0.sig.s,
//             })
//         ).to.be.revertedWith("SHOYU: FAILED_TO_TRANSFER_FUNDS");
//         assert.isFalse(await nft1155_0.isCancelledOrClaimed(askOrder0.hash));
//         expect(await nft1155_0.ownerOf(0)).to.be.equal(alice.address);
//     });

//     it("should be that fees are transfered properly", async () => {
//         const {
//             factory,
//             operationalVault,
//             protocolVault,
//             nft1155,
//             royaltyVault,
//             erc20Mock,
//             englishAuction,
//             fixedPriceSale,
//             designatedSale,
//             exchangeProxy,
//         } = await setupTest();

//         const { alice, bob, carol, dan, erin, frank } = getWallets();

//         await factory.setDeployerWhitelisted(AddressZero, true);
//         await factory.upgradeNFT1155(nft1155.address);

//         await factory.deployNFT1155AndMintBatch(
//             alice.address,
//             "Name",
//             "Symbol",
//             [0, 1, 2, 3],
//             royaltyVault.address,
//             10
//         );
//         const nft1155_0 = await getNFT1155(factory);

//         await factory.setStrategyWhitelisted(englishAuction.address, true);
//         await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
//         await factory.setStrategyWhitelisted(designatedSale.address, true);
//         const currentBlock = await getBlock();
//         const deadline = currentBlock + 100;

//         await erc20Mock.mint(bob.address, 10000000);
//         await erc20Mock.mint(carol.address, 10000000);
//         await erc20Mock.mint(dan.address, 10000000);
//         await erc20Mock.mint(erin.address, 10000000);
//         await erc20Mock.connect(bob).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(carol).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(dan).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(erin).approve(nft1155_0.address, 10000000);

//         //protocol 25 operator 5 royalty 10
//         const askOrder0 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             0,
//             1,
//             englishAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256"], [50])
//         );
//         const askOrder1 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             1,
//             1,
//             fixedPriceSale.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256"], [12345])
//         );
//         const askOrder2 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             2,
//             1,
//             designatedSale.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256", "address"], [100, exchangeProxy.address])
//         );
//         const askOrder3 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             3,
//             1,
//             fixedPriceSale.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256"], [15000])
//         );

//         await expect(
//             nft1155_0
//                 .connect(bob)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_0.address,
//                         tokenId: 0,
//                         amount: 1,
//                         strategy: englishAuction.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256"], [50]),
//                         v: askOrder0.sig.v,
//                         r: askOrder0.sig.r,
//                         s: askOrder0.sig.s,
//                     },
//                     1,
//                     100,
//                     AddressZero,
//                     AddressZero
//                 )
//         )
//             .to.emit(nft1155_0, "Bid")
//             .withArgs(askOrder0.hash, bob.address, 1, 100, AddressZero, AddressZero);

//         const fees0 = fees(12345, 25, 5, 10);
//         await expect(() =>
//             nft1155_0
//                 .connect(carol)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_0.address,
//                         tokenId: 1,
//                         amount: 1,
//                         strategy: fixedPriceSale.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256"], [12345]),
//                         v: askOrder1.sig.v,
//                         r: askOrder1.sig.r,
//                         s: askOrder1.sig.s,
//                     },
//                     1,
//                     12345,
//                     AddressZero,
//                     AddressZero
//                 )
//         ).to.changeTokenBalances(
//             erc20Mock,
//             [carol, protocolVault, operationalVault, royaltyVault, alice],
//             [-12345, fees0[0], fees0[1], fees0[2], fees0[3]]
//         );

//         await erc20Mock.connect(dan).approve(exchangeProxy.address, 10000000);
//         await exchangeProxy.setClaimerWhitelisted(frank.address, true);
//         const bidOrder2 = await signBid(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             askOrder2.hash,
//             dan,
//             1,
//             31313,
//             dan.address,
//             AddressZero
//         );
//         const fees1 = fees(31313, 25, 5, 10);
//         await expect(() =>
//             exchangeProxy.connect(frank).claim(
//                 nft1155_0.address,
//                 {
//                     signer: alice.address,
//                     token: nft1155_0.address,
//                     tokenId: 2,
//                     amount: 1,
//                     strategy: designatedSale.address,
//                     currency: erc20Mock.address,
//                     recipient: AddressZero,
//                     deadline: deadline,
//                     params: defaultAbiCoder.encode(["uint256", "address"], [100, exchangeProxy.address]),
//                     v: askOrder2.sig.v,
//                     r: askOrder2.sig.r,
//                     s: askOrder2.sig.s,
//                 },
//                 {
//                     askHash: askOrder2.hash,
//                     signer: dan.address,
//                     amount: 1,
//                     price: 31313,
//                     recipient: dan.address,
//                     referrer: AddressZero,
//                     v: bidOrder2.sig.v,
//                     r: bidOrder2.sig.r,
//                     s: bidOrder2.sig.s,
//                 }
//             )
//         ).to.changeTokenBalances(
//             erc20Mock,
//             [dan, protocolVault, operationalVault, royaltyVault, alice, frank, exchangeProxy],
//             [-31313, fees1[0], fees1[1], fees1[2], fees1[3], 0, 0]
//         );

//         await factory.setProtocolFeeRecipient(erin.address);
//         await factory.setOperationalFeeRecipient(frank.address);
//         await factory.setOperationalFee(17);
//         await nft1155_0.connect(alice).setRoyaltyFeeRecipient(carol.address);
//         await nft1155_0.connect(alice).setRoyaltyFee(4);

//         //erin 25/1000 frank 17/1000 carol 4/1000
//         const fees2 = fees(15000, 25, 17, 4);
//         await expect(() =>
//             nft1155_0
//                 .connect(dan)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_0.address,
//                         tokenId: 3,
//                         amount: 1,
//                         strategy: fixedPriceSale.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256"], [15000]),
//                         v: askOrder3.sig.v,
//                         r: askOrder3.sig.r,
//                         s: askOrder3.sig.s,
//                     },
//                     1,
//                     15000,
//                     AddressZero,
//                     AddressZero
//                 )
//         ).to.changeTokenBalances(
//             erc20Mock,
//             [dan, erin, frank, carol, alice, protocolVault, operationalVault, royaltyVault],
//             [-15000, fees2[0], fees2[1], fees2[2], fees2[3], 0, 0, 0]
//         );

//         await mine(100);

//         const fees3 = fees(100, 25, 17, 4);
//         assert.isTrue(deadline < (await getBlock()));
//         await expect(() =>
//             nft1155_0.claim({
//                 signer: alice.address,
//                 token: nft1155_0.address,
//                 tokenId: 0,
//                 amount: 1,
//                 strategy: englishAuction.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline,
//                 params: defaultAbiCoder.encode(["uint256"], [50]),
//                 v: askOrder0.sig.v,
//                 r: askOrder0.sig.r,
//                 s: askOrder0.sig.s,
//             })
//         ).to.changeTokenBalances(
//             erc20Mock,
//             [bob, erin, frank, carol, alice, protocolVault, operationalVault, royaltyVault],
//             [-100, fees3[0], fees3[1], fees3[2], fees3[3], 0, 0, 0]
//         );

//         await factory.deployNFT1155AndMintBatch(alice.address, "Name2", "Symbol2", [0], royaltyVault.address, 0);
//         const nft1155_1 = await getNFT1155(factory);

//         const askOrder4 = await signAsk(
//             ethers.provider,
//             "Name2",
//             nft1155_1.address,
//             alice,
//             nft1155_1.address,
//             0,
//             1,
//             fixedPriceSale.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline + 1000,
//             defaultAbiCoder.encode(["uint256"], [11000])
//         );

//         //erin 25/1000 frank 17/1000 royalty 0/1000
//         const fees4 = fees(11000, 25, 17, 0);
//         await erc20Mock.connect(dan).approve(nft1155_1.address, 10000000);
//         await expect(() =>
//             nft1155_1
//                 .connect(dan)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_1.address,
//                         tokenId: 0,
//                         amount: 1,
//                         strategy: fixedPriceSale.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline + 1000,
//                         params: defaultAbiCoder.encode(["uint256"], [11000]),
//                         v: askOrder4.sig.v,
//                         r: askOrder4.sig.r,
//                         s: askOrder4.sig.s,
//                     },
//                     1,
//                     11000,
//                     AddressZero,
//                     AddressZero
//                 )
//         ).to.changeTokenBalances(
//             erc20Mock,
//             [dan, erin, frank, carol, alice, protocolVault, operationalVault, royaltyVault],
//             [-11000, fees4[0], fees4[1], fees4[2], fees4[3], 0, 0, 0]
//         );
//         expect(fees4[2]).to.be.equal(0);
//     });

//     it("should be that parked tokens are minted automatically when they are claimed", async () => {
//         const {
//             factory,
//             nft1155,
//             royaltyVault,
//             erc20Mock,
//             englishAuction,
//             dutchAuction,
//             fixedPriceSale,
//             designatedSale,
//             exchangeProxy,
//         } = await setupTest();

//         const { alice, bob, carol, dan, erin, frank } = getWallets();

//         await factory.setDeployerWhitelisted(AddressZero, true);
//         await factory.upgradeNFT1155(nft1155.address);

//         await factory.deployNFT1155AndPark(alice.address, "Name", "Symbol", 10, royaltyVault.address, 10);
//         const nft1155_0 = await getNFT1155(factory);

//         await factory.setStrategyWhitelisted(englishAuction.address, true);
//         await factory.setStrategyWhitelisted(dutchAuction.address, true);
//         await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
//         await factory.setStrategyWhitelisted(designatedSale.address, true);
//         const currentBlock = await getBlock();
//         const deadline = currentBlock + 100;

//         await erc20Mock.mint(bob.address, 10000000);
//         await erc20Mock.mint(carol.address, 10000000);
//         await erc20Mock.mint(dan.address, 10000000);
//         await erc20Mock.mint(erin.address, 10000000);
//         await erc20Mock.mint(frank.address, 10000000);
//         await erc20Mock.connect(bob).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(carol).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(dan).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(erin).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(frank).approve(nft1155_0.address, 10000000);

//         const askOrder0 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             0,
//             1,
//             englishAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256"], [50])
//         );
//         const askOrder1 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             1,
//             1,
//             dutchAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentBlock])
//         );
//         const askOrder2 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             2,
//             1,
//             fixedPriceSale.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256"], [100])
//         );
//         const askOrder3 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             3,
//             1,
//             designatedSale.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256", "address"], [100, exchangeProxy.address])
//         );
//         const askOrder4 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             10,
//             1,
//             fixedPriceSale.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256"], [100])
//         );

//         expect(await nft1155_0.parked(0)).to.be.true;
//         expect(await nft1155_0.parked(1)).to.be.true;
//         expect(await nft1155_0.parked(2)).to.be.true;
//         expect(await nft1155_0.parked(3)).to.be.true;
//         expect(await nft1155_0.parked(10)).to.be.false;

//         await expect(
//             nft1155_0
//                 .connect(bob)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_0.address,
//                         tokenId: 0,
//                         amount: 1,
//                         strategy: englishAuction.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256"], [50]),
//                         v: askOrder0.sig.v,
//                         r: askOrder0.sig.r,
//                         s: askOrder0.sig.s,
//                     },
//                     1,
//                     100,
//                     AddressZero,
//                     AddressZero
//                 )
//         )
//             .to.emit(nft1155_0, "Bid")
//             .withArgs(askOrder0.hash, bob.address, 1, 100, AddressZero, AddressZero);

//         expect(await nft1155_0.ownerOf(1)).to.be.equal(AddressZero);
//         await nft1155_0
//             .connect(carol)
//             [
//                 "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//             ](
//                 {
//                     signer: alice.address,
//                     token: nft1155_0.address,
//                     tokenId: 1,
//                     amount: 1,
//                     strategy: dutchAuction.address,
//                     currency: erc20Mock.address,
//                     recipient: AddressZero,
//                     deadline: deadline,
//                     params: defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentBlock]),
//                     v: askOrder1.sig.v,
//                     r: askOrder1.sig.r,
//                     s: askOrder1.sig.s,
//                 },
//                 1,
//                 999,
//                 AddressZero,
//                 AddressZero
//             );
//         expect(await nft1155_0.ownerOf(1)).to.be.equal(carol.address);

//         expect(await nft1155_0.ownerOf(2)).to.be.equal(AddressZero);
//         await nft1155_0
//             .connect(dan)
//             [
//                 "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//             ](
//                 {
//                     signer: alice.address,
//                     token: nft1155_0.address,
//                     tokenId: 2,
//                     amount: 1,
//                     strategy: fixedPriceSale.address,
//                     currency: erc20Mock.address,
//                     recipient: AddressZero,
//                     deadline: deadline,
//                     params: defaultAbiCoder.encode(["uint256"], [100]),
//                     v: askOrder2.sig.v,
//                     r: askOrder2.sig.r,
//                     s: askOrder2.sig.s,
//                 },
//                 1,
//                 100,
//                 AddressZero,
//                 AddressZero
//             );
//         expect(await nft1155_0.ownerOf(2)).to.be.equal(dan.address);

//         expect(await nft1155_0.ownerOf(3)).to.be.equal(AddressZero);
//         await erc20Mock.connect(dan).approve(exchangeProxy.address, 1000);
//         await exchangeProxy.setClaimerWhitelisted(frank.address, true);
//         const bidOrder3 = await signBid(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             askOrder3.hash,
//             dan,
//             1,
//             101,
//             dan.address,
//             AddressZero
//         );
//         await exchangeProxy.connect(frank).claim(
//             nft1155_0.address,
//             {
//                 signer: alice.address,
//                 token: nft1155_0.address,
//                 tokenId: 3,
//                 amount: 1,
//                 strategy: designatedSale.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline,
//                 params: defaultAbiCoder.encode(["uint256", "address"], [100, exchangeProxy.address]),
//                 v: askOrder3.sig.v,
//                 r: askOrder3.sig.r,
//                 s: askOrder3.sig.s,
//             },
//             {
//                 askHash: askOrder3.hash,
//                 signer: dan.address,
//                 amount: 1,
//                 price: 101,
//                 recipient: dan.address,
//                 referrer: AddressZero,
//                 v: bidOrder3.sig.v,
//                 r: bidOrder3.sig.r,
//                 s: bidOrder3.sig.s,
//             }
//         );
//         expect(await nft1155_0.ownerOf(3)).to.be.equal(dan.address);

//         expect(await nft1155_0.ownerOf(10)).to.be.equal(AddressZero);
//         expect(await nft1155_0.parked(10)).to.be.false;
//         await expect(
//             nft1155_0
//                 .connect(erin)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_0.address,
//                         tokenId: 10,
//                         amount: 1,
//                         strategy: fixedPriceSale.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256"], [100]),
//                         v: askOrder4.sig.v,
//                         r: askOrder4.sig.r,
//                         s: askOrder4.sig.s,
//                     },
//                     1,
//                     100,
//                     AddressZero,
//                     AddressZero
//                 )
//         ).to.be.revertedWith("SHOYU: TRANSFER_FORBIDDEN");

//         await mine(100);
//         expect(await nft1155_0.ownerOf(0)).to.be.equal(AddressZero);
//         await nft1155_0.claim({
//             signer: alice.address,
//             token: nft1155_0.address,
//             tokenId: 0,
//             amount: 1,
//             strategy: englishAuction.address,
//             currency: erc20Mock.address,
//             recipient: AddressZero,
//             deadline: deadline,
//             params: defaultAbiCoder.encode(["uint256"], [50]),
//             v: askOrder0.sig.v,
//             r: askOrder0.sig.r,
//             s: askOrder0.sig.s,
//         });
//         expect(await nft1155_0.ownerOf(0)).to.be.equal(bob.address);

//         assert.isFalse(await nft1155_0.parked(0));
//         assert.isFalse(await nft1155_0.parked(1));
//         assert.isFalse(await nft1155_0.parked(2));
//         assert.isFalse(await nft1155_0.parked(3));

//         assert.isTrue(await nft1155_0.parked(4));
//         assert.isTrue(await nft1155_0.parked(5));
//         assert.isTrue(await nft1155_0.parked(6));
//         assert.isTrue(await nft1155_0.parked(7));
//         assert.isTrue(await nft1155_0.parked(8));
//         assert.isTrue(await nft1155_0.parked(9));

//         assert.isFalse(await nft1155_0.parked(10));
//         assert.isFalse(await nft1155_0.parked(11));
//         assert.isFalse(await nft1155_0.parked(12));
//     });

//     it("should be that NFT tokens can be traded on itself not others", async () => {
//         const { factory, nft1155, royaltyVault, erc1155Mock, erc20Mock, fixedPriceSale } = await setupTest();

//         const { alice, bob, carol } = getWallets();

//         await factory.setDeployerWhitelisted(AddressZero, true);
//         await factory.upgradeNFT1155(nft1155.address);

//         await factory.deployNFT1155AndMintBatch(
//             alice.address,
//             "Name",
//             "Symbol",
//             [0, 1, 2, 3],
//             royaltyVault.address,
//             10
//         );
//         const nft1155_0 = await getNFT1155(factory);

//         await factory.deployNFT1155AndMintBatch(
//             alice.address,
//             "Name2",
//             "Symbol2",
//             [0, 1, 2, 3],
//             royaltyVault.address,
//             10
//         );
//         const nft1155_1 = await getNFT1155(factory);

//         await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
//         const currentBlock = await getBlock();
//         const deadline = currentBlock + 100;

//         await erc20Mock.mint(bob.address, 10000000);
//         await erc20Mock.connect(bob).approve(nft1155_0.address, 10000000);

//         const askOrder0 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_1.address,
//             0,
//             1,
//             fixedPriceSale.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256"], [50])
//         );
//         const askOrder1 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             erc1155Mock.address,
//             0,
//             1,
//             fixedPriceSale.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256"], [50])
//         );

//         assert.isFalse(await nft1155_0.canTrade(nft1155_1.address));
//         assert.isFalse(await nft1155_0.canTrade(erc1155Mock.address));

//         await expect(
//             nft1155_0
//                 .connect(bob)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_1.address,
//                         tokenId: 0,
//                         amount: 1,
//                         strategy: fixedPriceSale.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256"], [100]),
//                         v: askOrder0.sig.v,
//                         r: askOrder0.sig.r,
//                         s: askOrder0.sig.s,
//                     },
//                     1,
//                     100,
//                     AddressZero,
//                     AddressZero
//                 )
//         ).to.be.revertedWith("SHOYU: INVALID_EXCHANGE");

//         await expect(
//             nft1155_0
//                 .connect(bob)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: erc1155Mock.address,
//                         tokenId: 0,
//                         amount: 1,
//                         strategy: fixedPriceSale.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256"], [100]),
//                         v: askOrder1.sig.v,
//                         r: askOrder1.sig.r,
//                         s: askOrder1.sig.s,
//                     },
//                     1,
//                     100,
//                     AddressZero,
//                     AddressZero
//                 )
//         ).to.be.revertedWith("SHOYU: INVALID_EXCHANGE");
//     });

//     it("should be that claimed orders can be used again even if it's back to an initial owner", async () => {
//         const {
//             factory,
//             nft1155,
//             royaltyVault,
//             erc20Mock,
//             englishAuction,
//             dutchAuction,
//             fixedPriceSale,
//             designatedSale,
//             exchangeProxy,
//         } = await setupTest();

//         const { alice, bob, carol, dan, erin, frank } = getWallets();

//         await factory.setDeployerWhitelisted(AddressZero, true);
//         await factory.upgradeNFT1155(nft1155.address);

//         await factory.deployNFT1155AndPark(alice.address, "Name", "Symbol", 10, royaltyVault.address, 10);
//         const nft1155_0 = await getNFT1155(factory);

//         await factory.setStrategyWhitelisted(englishAuction.address, true);
//         await factory.setStrategyWhitelisted(dutchAuction.address, true);
//         await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
//         await factory.setStrategyWhitelisted(designatedSale.address, true);
//         const currentBlock = await getBlock();
//         const deadline = currentBlock + 100;

//         await erc20Mock.mint(bob.address, 10000000);
//         await erc20Mock.mint(carol.address, 10000000);
//         await erc20Mock.mint(dan.address, 10000000);
//         await erc20Mock.mint(erin.address, 10000000);
//         await erc20Mock.mint(frank.address, 10000000);
//         await erc20Mock.connect(bob).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(carol).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(dan).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(erin).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(frank).approve(nft1155_0.address, 10000000);

//         const askOrder0 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             0,
//             1,
//             englishAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256"], [50])
//         );
//         const askOrder1 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             1,
//             1,
//             dutchAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentBlock])
//         );
//         const askOrder2 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             2,
//             1,
//             fixedPriceSale.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256"], [100])
//         );
//         const askOrder3 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             3,
//             1,
//             designatedSale.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256", "address"], [100, exchangeProxy.address])
//         );

//         await expect(
//             nft1155_0
//                 .connect(bob)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_0.address,
//                         tokenId: 0,
//                         amount: 1,
//                         strategy: englishAuction.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256"], [50]),
//                         v: askOrder0.sig.v,
//                         r: askOrder0.sig.r,
//                         s: askOrder0.sig.s,
//                     },
//                     1,
//                     100,
//                     AddressZero,
//                     AddressZero
//                 )
//         )
//             .to.emit(nft1155_0, "Bid")
//             .withArgs(askOrder0.hash, bob.address, 1, 100, AddressZero, AddressZero);

//         await nft1155_0
//             .connect(carol)
//             [
//                 "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//             ](
//                 {
//                     signer: alice.address,
//                     token: nft1155_0.address,
//                     tokenId: 1,
//                     amount: 1,
//                     strategy: dutchAuction.address,
//                     currency: erc20Mock.address,
//                     recipient: AddressZero,
//                     deadline: deadline,
//                     params: defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentBlock]),
//                     v: askOrder1.sig.v,
//                     r: askOrder1.sig.r,
//                     s: askOrder1.sig.s,
//                 },
//                 1,
//                 999,
//                 AddressZero,
//                 AddressZero
//             );

//         await nft1155_0
//             .connect(dan)
//             [
//                 "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//             ](
//                 {
//                     signer: alice.address,
//                     token: nft1155_0.address,
//                     tokenId: 2,
//                     amount: 1,
//                     strategy: fixedPriceSale.address,
//                     currency: erc20Mock.address,
//                     recipient: AddressZero,
//                     deadline: deadline,
//                     params: defaultAbiCoder.encode(["uint256"], [100]),
//                     v: askOrder2.sig.v,
//                     r: askOrder2.sig.r,
//                     s: askOrder2.sig.s,
//                 },
//                 1,
//                 100,
//                 AddressZero,
//                 AddressZero
//             );

//         await erc20Mock.connect(dan).approve(exchangeProxy.address, 10000);
//         await exchangeProxy.setClaimerWhitelisted(frank.address, true);
//         const bidOrder3 = await signBid(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             askOrder3.hash,
//             dan,
//             1,
//             101,
//             dan.address,
//             AddressZero
//         );
//         await exchangeProxy.connect(frank).claim(
//             nft1155_0.address,
//             {
//                 signer: alice.address,
//                 token: nft1155_0.address,
//                 tokenId: 3,
//                 amount: 1,
//                 strategy: designatedSale.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline,
//                 params: defaultAbiCoder.encode(["uint256", "address"], [100, exchangeProxy.address]),
//                 v: askOrder3.sig.v,
//                 r: askOrder3.sig.r,
//                 s: askOrder3.sig.s,
//             },
//             {
//                 askHash: askOrder3.hash,
//                 signer: dan.address,
//                 amount: 1,
//                 price: 101,
//                 recipient: dan.address,
//                 referrer: AddressZero,
//                 v: bidOrder3.sig.v,
//                 r: bidOrder3.sig.r,
//                 s: bidOrder3.sig.s,
//             }
//         );

//         await expect(
//             nft1155_0
//                 .connect(carol)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_0.address,
//                         tokenId: 1,
//                         amount: 1,
//                         strategy: dutchAuction.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentBlock]),
//                         v: askOrder1.sig.v,
//                         r: askOrder1.sig.r,
//                         s: askOrder1.sig.s,
//                     },
//                     1,
//                     999,
//                     AddressZero,
//                     AddressZero
//                 )
//         ).to.be.revertedWith("SHOYU: SOLD_OUT");

//         await expect(
//             nft1155_0
//                 .connect(dan)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_0.address,
//                         tokenId: 2,
//                         amount: 1,
//                         strategy: fixedPriceSale.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256"], [100]),
//                         v: askOrder2.sig.v,
//                         r: askOrder2.sig.r,
//                         s: askOrder2.sig.s,
//                     },
//                     1,
//                     100,
//                     AddressZero,
//                     AddressZero
//                 )
//         ).to.be.revertedWith("SHOYU: SOLD_OUT");
//         const bidOrder3_ = await signBid(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             askOrder3.hash,
//             dan,
//             1,
//             101,
//             dan.address,
//             AddressZero
//         );
//         await expect(
//             exchangeProxy.connect(frank).claim(
//                 nft1155_0.address,
//                 {
//                     signer: alice.address,
//                     token: nft1155_0.address,
//                     tokenId: 3,
//                     amount: 1,
//                     strategy: designatedSale.address,
//                     currency: erc20Mock.address,
//                     recipient: AddressZero,
//                     deadline: deadline,
//                     params: defaultAbiCoder.encode(["uint256", "address"], [100, exchangeProxy.address]),
//                     v: askOrder3.sig.v,
//                     r: askOrder3.sig.r,
//                     s: askOrder3.sig.s,
//                 },
//                 {
//                     askHash: askOrder3.hash,
//                     signer: dan.address,
//                     amount: 1,
//                     price: 101,
//                     recipient: dan.address,
//                     referrer: AddressZero,
//                     v: bidOrder3_.sig.v,
//                     r: bidOrder3_.sig.r,
//                     s: bidOrder3_.sig.s,
//                 }
//             )
//         ).to.be.revertedWith("SHOYU: SOLD_OUT");

//         await nft1155_0.connect(carol).transferFrom(carol.address, alice.address, 1);
//         await nft1155_0.connect(dan).transferFrom(dan.address, alice.address, 2);
//         await nft1155_0.connect(dan).transferFrom(dan.address, alice.address, 3);

//         await expect(
//             nft1155_0
//                 .connect(carol)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_0.address,
//                         tokenId: 1,
//                         amount: 1,
//                         strategy: dutchAuction.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentBlock]),
//                         v: askOrder1.sig.v,
//                         r: askOrder1.sig.r,
//                         s: askOrder1.sig.s,
//                     },
//                     1,
//                     999,
//                     AddressZero,
//                     AddressZero
//                 )
//         ).to.be.revertedWith("SHOYU: SOLD_OUT");

//         await expect(
//             nft1155_0
//                 .connect(dan)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_0.address,
//                         tokenId: 2,
//                         amount: 1,
//                         strategy: fixedPriceSale.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256"], [100]),
//                         v: askOrder2.sig.v,
//                         r: askOrder2.sig.r,
//                         s: askOrder2.sig.s,
//                     },
//                     1,
//                     100,
//                     AddressZero,
//                     AddressZero
//                 )
//         ).to.be.revertedWith("SHOYU: SOLD_OUT");

//         await expect(
//             exchangeProxy.connect(frank).claim(
//                 nft1155_0.address,
//                 {
//                     signer: alice.address,
//                     token: nft1155_0.address,
//                     tokenId: 3,
//                     amount: 1,
//                     strategy: designatedSale.address,
//                     currency: erc20Mock.address,
//                     recipient: AddressZero,
//                     deadline: deadline,
//                     params: defaultAbiCoder.encode(["uint256", "address"], [100, exchangeProxy.address]),
//                     v: askOrder3.sig.v,
//                     r: askOrder3.sig.r,
//                     s: askOrder3.sig.s,
//                 },
//                 {
//                     askHash: askOrder3.hash,
//                     signer: dan.address,
//                     amount: 1,
//                     price: 101,
//                     recipient: dan.address,
//                     referrer: AddressZero,
//                     v: bidOrder3_.sig.v,
//                     r: bidOrder3_.sig.r,
//                     s: bidOrder3_.sig.s,
//                 }
//             )
//         ).to.be.revertedWith("SHOYU: SOLD_OUT");

//         await mine(100);
//         await nft1155_0.claim({
//             signer: alice.address,
//             token: nft1155_0.address,
//             tokenId: 0,
//             amount: 1,
//             strategy: englishAuction.address,
//             currency: erc20Mock.address,
//             recipient: AddressZero,
//             deadline: deadline,
//             params: defaultAbiCoder.encode(["uint256"], [50]),
//             v: askOrder0.sig.v,
//             r: askOrder0.sig.r,
//             s: askOrder0.sig.s,
//         });

//         await expect(
//             nft1155_0
//                 .connect(bob)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_0.address,
//                         tokenId: 0,
//                         amount: 1,
//                         strategy: englishAuction.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256"], [50]),
//                         v: askOrder0.sig.v,
//                         r: askOrder0.sig.r,
//                         s: askOrder0.sig.s,
//                     },
//                     1,
//                     100,
//                     AddressZero,
//                     AddressZero
//                 )
//         ).to.be.revertedWith("SHOYU: SOLD_OUT");

//         await nft1155_0.connect(bob).transferFrom(bob.address, alice.address, 0);

//         await expect(
//             nft1155_0
//                 .connect(bob)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_0.address,
//                         tokenId: 0,
//                         amount: 1,
//                         strategy: englishAuction.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256"], [50]),
//                         v: askOrder0.sig.v,
//                         r: askOrder0.sig.r,
//                         s: askOrder0.sig.s,
//                     },
//                     1,
//                     100,
//                     AddressZero,
//                     AddressZero
//                 )
//         ).to.be.revertedWith("SHOYU: SOLD_OUT");
//     });

//     it("should be that BestBid is replaced if someone bid with higher price", async () => {
//         const { factory, nft1155, royaltyVault, erc20Mock, englishAuction } = await setupTest();

//         const { alice, bob, carol, dan } = getWallets();

//         await factory.setDeployerWhitelisted(AddressZero, true);
//         await factory.upgradeNFT1155(nft1155.address);

//         await factory.deployNFT1155AndMintBatch(alice.address, "Name", "Symbol", [0, 1, 2], royaltyVault.address, 10);
//         const nft1155_0 = await getNFT1155(factory);
//         await nft1155_0.connect(alice).transferFrom(alice.address, bob.address, 1);

//         await factory.setStrategyWhitelisted(englishAuction.address, true);
//         const currentBlock = await getBlock();
//         const deadline = currentBlock + 100;

//         const askOrder0 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             0,
//             1,
//             englishAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256"], [50])
//         );

//         await nft1155_0
//             .connect(bob)
//             [
//                 "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//             ](
//                 {
//                     signer: alice.address,
//                     token: nft1155_0.address,
//                     tokenId: 0,
//                     amount: 1,
//                     strategy: englishAuction.address,
//                     currency: erc20Mock.address,
//                     recipient: AddressZero,
//                     deadline: deadline,
//                     params: defaultAbiCoder.encode(["uint256"], [50]),
//                     v: askOrder0.sig.v,
//                     r: askOrder0.sig.r,
//                     s: askOrder0.sig.s,
//                 },
//                 1,
//                 100,
//                 AddressZero,
//                 AddressZero
//             );
//         expect((await nft1155_0.bestBid(askOrder0.hash))[0]).to.be.equal(bob.address);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[1]).to.be.equal(1);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[2]).to.be.equal(100);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[3]).to.be.equal(AddressZero);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[4]).to.be.equal(AddressZero);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[5]).to.be.equal(await ethers.provider.getBlockNumber());

//         await mine(11);
//         await nft1155_0
//             .connect(carol)
//             [
//                 "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//             ](
//                 {
//                     signer: alice.address,
//                     token: nft1155_0.address,
//                     tokenId: 0,
//                     amount: 1,
//                     strategy: englishAuction.address,
//                     currency: erc20Mock.address,
//                     recipient: AddressZero,
//                     deadline: deadline,
//                     params: defaultAbiCoder.encode(["uint256"], [50]),
//                     v: askOrder0.sig.v,
//                     r: askOrder0.sig.r,
//                     s: askOrder0.sig.s,
//                 },
//                 1,
//                 110,
//                 AddressZero,
//                 AddressZero
//             );
//         expect((await nft1155_0.bestBid(askOrder0.hash))[0]).to.be.equal(carol.address);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[1]).to.be.equal(1);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[2]).to.be.equal(110);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[3]).to.be.equal(AddressZero);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[4]).to.be.equal(AddressZero);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[5]).to.be.equal(await ethers.provider.getBlockNumber());

//         await mine(11);
//         await expect(
//             nft1155_0
//                 .connect(dan)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_0.address,
//                         tokenId: 0,
//                         amount: 1,
//                         strategy: englishAuction.address,
//                         currency: erc20Mock.address,
//                         recipient: AddressZero,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256"], [50]),
//                         v: askOrder0.sig.v,
//                         r: askOrder0.sig.r,
//                         s: askOrder0.sig.s,
//                     },
//                     1,
//                     110,
//                     AddressZero,
//                     AddressZero
//                 )
//         ).to.be.revertedWith("SHOYU: FAILURE");
//     });

//     it("should be that bid(Orders.Ask memory askOrder, Orders.Bid memory bidOrder) function works well", async () => {
//         const {
//             factory,
//             nft1155,
//             royaltyVault,
//             erc20Mock,
//             englishAuction,
//             dutchAuction,
//             fixedPriceSale,
//             designatedSale,
//             exchangeProxy,
//         } = await setupTest();

//         const { alice, bob, carol, dan, erin, frank } = getWallets();

//         await factory.setDeployerWhitelisted(AddressZero, true);
//         await factory.upgradeNFT1155(nft1155.address);

//         await factory.deployNFT1155AndPark(alice.address, "Name", "Symbol", 10, royaltyVault.address, 10);
//         const nft1155_0 = await getNFT1155(factory);

//         await factory.setStrategyWhitelisted(englishAuction.address, true);
//         await factory.setStrategyWhitelisted(dutchAuction.address, true);
//         await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
//         await factory.setStrategyWhitelisted(designatedSale.address, true);
//         const currentBlock = await getBlock();
//         const deadline = currentBlock + 100;

//         await erc20Mock.mint(bob.address, 10000000);
//         await erc20Mock.mint(carol.address, 10000000);
//         await erc20Mock.mint(dan.address, 10000000);
//         await erc20Mock.mint(erin.address, 10000000);
//         await erc20Mock.mint(frank.address, 10000000);
//         await erc20Mock.connect(bob).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(carol).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(dan).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(erin).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(frank).approve(nft1155_0.address, 10000000);

//         const askOrder0 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             0,
//             1,
//             englishAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256"], [50])
//         );
//         const askOrder1 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             1,
//             1,
//             dutchAuction.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentBlock])
//         );
//         const askOrder2 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             2,
//             1,
//             fixedPriceSale.address,
//             erc20Mock.address,
//             AddressZero,
//             deadline,
//             defaultAbiCoder.encode(["uint256"], [100])
//         );

//         await erc20Mock.connect(dan).approve(exchangeProxy.address, 1000);
//         await exchangeProxy.setClaimerWhitelisted(frank.address, true);

//         const bidOrder0 = await signBid(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             askOrder0.hash,
//             bob,
//             1,
//             101,
//             AddressZero,
//             AddressZero
//         );
//         const bidOrder1 = await signBid(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             askOrder1.hash,
//             carol,
//             1,
//             990,
//             AddressZero,
//             AddressZero
//         );
//         const bidOrder2 = await signBid(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             askOrder2.hash,
//             dan,
//             1,
//             100,
//             AddressZero,
//             AddressZero
//         );

//         await expect(
//             nft1155_0[
//                 "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),(bytes32,address,uint256,uint256,address,address,uint8,bytes32,bytes32))"
//             ](
//                 {
//                     signer: alice.address,
//                     token: nft1155_0.address,
//                     tokenId: 1,
//                     amount: 1,
//                     strategy: dutchAuction.address,
//                     currency: erc20Mock.address,
//                     recipient: AddressZero,
//                     deadline: deadline,
//                     params: defaultAbiCoder.encode(["uint256", "uint256", "uint256"], [1000, 100, currentBlock]),
//                     v: askOrder1.sig.v,
//                     r: askOrder1.sig.r,
//                     s: askOrder1.sig.s,
//                 },
//                 {
//                     askHash: askOrder1.hash,
//                     signer: carol.address,
//                     amount: 1,
//                     price: 990,
//                     recipient: AddressZero,
//                     referrer: AddressZero,
//                     v: bidOrder1.sig.v,
//                     r: bidOrder1.sig.r,
//                     s: bidOrder1.sig.s,
//                 }
//             )
//         )
//             .to.emit(nft1155_0, "Claim")
//             .withArgs(askOrder1.hash, carol.address, 1, 990, carol.address, AddressZero);

//         await expect(
//             nft1155_0[
//                 "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),(bytes32,address,uint256,uint256,address,address,uint8,bytes32,bytes32))"
//             ](
//                 {
//                     signer: alice.address,
//                     token: nft1155_0.address,
//                     tokenId: 2,
//                     amount: 1,
//                     strategy: fixedPriceSale.address,
//                     currency: erc20Mock.address,
//                     recipient: AddressZero,
//                     deadline: deadline,
//                     params: defaultAbiCoder.encode(["uint256"], [100]),
//                     v: askOrder2.sig.v,
//                     r: askOrder2.sig.r,
//                     s: askOrder2.sig.s,
//                 },
//                 {
//                     askHash: askOrder2.hash,
//                     signer: dan.address,
//                     amount: 1,
//                     price: 100,
//                     recipient: AddressZero,
//                     referrer: AddressZero,
//                     v: bidOrder2.sig.v,
//                     r: bidOrder2.sig.r,
//                     s: bidOrder2.sig.s,
//                 }
//             )
//         )
//             .to.emit(nft1155_0, "Claim")
//             .withArgs(askOrder2.hash, dan.address, 1, 100, dan.address, AddressZero);

//         await nft1155_0[
//             "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),(bytes32,address,uint256,uint256,address,address,uint8,bytes32,bytes32))"
//         ](
//             {
//                 signer: alice.address,
//                 token: nft1155_0.address,
//                 tokenId: 0,
//                 amount: 1,
//                 strategy: englishAuction.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline,
//                 params: defaultAbiCoder.encode(["uint256"], [50]),
//                 v: askOrder0.sig.v,
//                 r: askOrder0.sig.r,
//                 s: askOrder0.sig.s,
//             },
//             {
//                 askHash: askOrder0.hash,
//                 signer: bob.address,
//                 amount: 1,
//                 price: 101,
//                 recipient: AddressZero,
//                 referrer: AddressZero,
//                 v: bidOrder0.sig.v,
//                 r: bidOrder0.sig.r,
//                 s: bidOrder0.sig.s,
//             }
//         );
//         expect((await nft1155_0.bestBid(askOrder0.hash))[0]).to.be.equal(bob.address);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[1]).to.be.equal(1);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[2]).to.be.equal(101);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[3]).to.be.equal(AddressZero);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[4]).to.be.equal(AddressZero);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[5]).to.be.equal(await ethers.provider.getBlockNumber());

//         await mine(15);

//         const bidOrder0_ = await signBid(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             askOrder0.hash,
//             carol,
//             1,
//             111,
//             AddressZero,
//             AddressZero
//         );

//         await nft1155_0[
//             "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),(bytes32,address,uint256,uint256,address,address,uint8,bytes32,bytes32))"
//         ](
//             {
//                 signer: alice.address,
//                 token: nft1155_0.address,
//                 tokenId: 0,
//                 amount: 1,
//                 strategy: englishAuction.address,
//                 currency: erc20Mock.address,
//                 recipient: AddressZero,
//                 deadline: deadline,
//                 params: defaultAbiCoder.encode(["uint256"], [50]),
//                 v: askOrder0.sig.v,
//                 r: askOrder0.sig.r,
//                 s: askOrder0.sig.s,
//             },
//             {
//                 askHash: askOrder0.hash,
//                 signer: carol.address,
//                 amount: 1,
//                 price: 111,
//                 recipient: AddressZero,
//                 referrer: AddressZero,
//                 v: bidOrder0_.sig.v,
//                 r: bidOrder0_.sig.r,
//                 s: bidOrder0_.sig.s,
//             }
//         );
//         expect((await nft1155_0.bestBid(askOrder0.hash))[0]).to.be.equal(carol.address);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[1]).to.be.equal(1);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[2]).to.be.equal(111);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[3]).to.be.equal(AddressZero);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[4]).to.be.equal(AddressZero);
//         expect((await nft1155_0.bestBid(askOrder0.hash))[5]).to.be.equal(await ethers.provider.getBlockNumber());
//     });

//     it("should be that fees and nft go to receipients if they are set in orders", async () => {
//         const {
//             factory,
//             operationalVault,
//             protocolVault,
//             nft1155,
//             royaltyVault,
//             erc20Mock,
//             englishAuction,
//             fixedPriceSale,
//         } = await setupTest();

//         const { alice, bob, carol, dan, erin, frank } = getWallets();

//         await factory.setDeployerWhitelisted(AddressZero, true);
//         await factory.upgradeNFT1155(nft1155.address);

//         await factory.deployNFT1155AndMintBatch(
//             alice.address,
//             "Name",
//             "Symbol",
//             [0, 1, 2, 3],
//             royaltyVault.address,
//             10
//         );
//         const nft1155_0 = await getNFT1155(factory);

//         await factory.setStrategyWhitelisted(englishAuction.address, true);
//         await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
//         const currentBlock = await getBlock();
//         const deadline = currentBlock + 100;

//         await erc20Mock.mint(bob.address, 10000000);
//         await erc20Mock.mint(carol.address, 10000000);
//         await erc20Mock.mint(dan.address, 10000000);
//         await erc20Mock.connect(bob).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(carol).approve(nft1155_0.address, 10000000);
//         await erc20Mock.connect(dan).approve(nft1155_0.address, 10000000);

//         //protocol 25 operator 5 royalty 10
//         const askOrder0 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             0,
//             1,
//             englishAuction.address,
//             erc20Mock.address,
//             erin.address,
//             deadline,
//             defaultAbiCoder.encode(["uint256"], [50])
//         );
//         const askOrder1 = await signAsk(
//             ethers.provider,
//             "Name",
//             nft1155_0.address,
//             alice,
//             nft1155_0.address,
//             1,
//             1,
//             fixedPriceSale.address,
//             erc20Mock.address,
//             frank.address,
//             deadline,
//             defaultAbiCoder.encode(["uint256"], [12345])
//         );

//         await expect(
//             nft1155_0
//                 .connect(bob)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_0.address,
//                         tokenId: 0,
//                         amount: 1,
//                         strategy: englishAuction.address,
//                         currency: erc20Mock.address,
//                         recipient: erin.address,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256"], [50]),
//                         v: askOrder0.sig.v,
//                         r: askOrder0.sig.r,
//                         s: askOrder0.sig.s,
//                     },
//                     1,
//                     100,
//                     dan.address,
//                     AddressZero
//                 )
//         )
//             .to.emit(nft1155_0, "Bid")
//             .withArgs(askOrder0.hash, bob.address, 1, 100, dan.address, AddressZero);
//         const fees0 = fees(12345, 25, 5, 10);

//         await expect(() =>
//             nft1155_0
//                 .connect(carol)
//                 [
//                     "bid((address,address,uint256,uint256,address,address,address,uint256,bytes,uint8,bytes32,bytes32),uint256,uint256,address,address)"
//                 ](
//                     {
//                         signer: alice.address,
//                         token: nft1155_0.address,
//                         tokenId: 1,
//                         amount: 1,
//                         strategy: fixedPriceSale.address,
//                         currency: erc20Mock.address,
//                         recipient: frank.address,
//                         deadline: deadline,
//                         params: defaultAbiCoder.encode(["uint256"], [12345]),
//                         v: askOrder1.sig.v,
//                         r: askOrder1.sig.r,
//                         s: askOrder1.sig.s,
//                     },
//                     1,
//                     12345,
//                     bob.address,
//                     AddressZero
//                 )
//         ).to.changeTokenBalances(
//             erc20Mock,
//             [carol, protocolVault, operationalVault, royaltyVault, frank, alice],
//             [-12345, fees0[0], fees0[1], fees0[2], fees0[3], 0]
//         );
//         expect(await nft1155_0.ownerOf(1)).to.be.equal(bob.address);

//         await mine(100);

//         const fees1 = fees(100, 25, 5, 10);
//         await expect(() =>
//             nft1155_0.claim({
//                 signer: alice.address,
//                 token: nft1155_0.address,
//                 tokenId: 0,
//                 amount: 1,
//                 strategy: englishAuction.address,
//                 currency: erc20Mock.address,
//                 recipient: erin.address,
//                 deadline: deadline,
//                 params: defaultAbiCoder.encode(["uint256"], [50]),
//                 v: askOrder0.sig.v,
//                 r: askOrder0.sig.r,
//                 s: askOrder0.sig.s,
//             })
//         ).to.changeTokenBalances(
//             erc20Mock,
//             [bob, protocolVault, operationalVault, royaltyVault, erin, alice],
//             [-100, fees1[0], fees1[1], fees1[2], fees1[3], 0]
//         );
//         expect(await nft1155_0.ownerOf(0)).to.be.equal(dan.address);
//     });
// });
