import {
    TokenFactory,
    ERC721Mock,
    ERC20Mock,
    EnglishAuction,
    DutchAuction,
    FixedPriceSale,
    NFT721V2,
    StaticCallMock,
} from "./typechain";

import { sign, convertToHash, domainSeparator, getDigest, getHash, signAsk, signBid } from "./utils/sign-utils";
import { ethers } from "hardhat";
import { BigNumber, BigNumberish, BytesLike, Wallet, Contract } from "ethers";
import { expect, assert } from "chai";
import { solidityPack, toUtf8String, defaultAbiCoder } from "ethers/lib/utils";
import { getBlockTimestamp, mine } from "./utils/blocks";
import { bid1, bid2 } from "./utils/bid_utils";

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

    const NFT721Contract = await ethers.getContractFactory("NFT721V2");
    const nft721 = (await NFT721Contract.deploy()) as NFT721V2;

    const ERC721MockContract = await ethers.getContractFactory("ERC721Mock");
    const erc721Mock = (await ERC721MockContract.deploy()) as ERC721Mock;

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
        nft721,
        alice,
        bob,
        carol,
        royaltyVault,
        erc721Mock,
        erc20Mock,
        englishAuction,
        dutchAuction,
        fixedPriceSale,
    };
};

async function getNFT721(factory: TokenFactory): Promise<NFT721V2> {
    let events: any = await factory.queryFilter(factory.filters.DeployNFT721AndMintBatch(), "latest");
    if (events.length == 0) events = await factory.queryFilter(factory.filters.DeployNFT721AndPark(), "latest");
    const NFT721Contract = await ethers.getContractFactory("NFT721V2");
    return (await NFT721Contract.attach(events[0].args[0])) as NFT721V2;
}

describe("NFT part of NFT721", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    it("should be that default values are set correctly with batch minting deploy", async () => {
        const { factory, nft721, alice, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(alice.address, "Name", "Symbol", [0, 2, 4], royaltyVault.address, 13);
        const nft721_0 = await getNFT721(factory);

        expect(await nft721_0.PERMIT_TYPEHASH()).to.be.equal(
            convertToHash("Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)")
        );
        expect(await nft721_0.PERMIT_ALL_TYPEHASH()).to.be.equal(
            convertToHash("Permit(address owner,address spender,uint256 nonce,uint256 deadline)")
        );
        expect(await nft721_0.DOMAIN_SEPARATOR()).to.be.equal(
            await domainSeparator(ethers.provider, "Name", nft721_0.address)
        );
        expect(await nft721_0.factory()).to.be.equal(factory.address);

        async function URI721(nft: NFT721V2, tokenId: number): Promise<string> {
            const baseURI = await factory.baseURI721();
            const addy = nft.address.toLowerCase();
            return toUtf8String(
                solidityPack(
                    ["string", "string", "string", "string", "string"],
                    [baseURI, addy, "/", tokenId.toString(), ".json"]
                )
            );
        }

        expect(await nft721_0.tokenURI(0)).to.be.equal(await URI721(nft721_0, 0));
        expect(await nft721_0.tokenURI(2)).to.be.equal(await URI721(nft721_0, 2));
        expect(await nft721_0.tokenURI(4)).to.be.equal(await URI721(nft721_0, 4));
        await expect(nft721_0.tokenURI(1)).to.be.revertedWith("SHOYU: INVALID_TOKEN_ID");

        expect((await nft721_0.royaltyInfo(0, 0))[0]).to.be.equal(royaltyVault.address);

        expect((await nft721_0.royaltyInfo(0, 12345))[1]).to.be.equal(Math.floor((12345 * 13) / 1000));

        for (let i = 0; i < 10; i++) {
            assert.isFalse(await nft721_0.parked(i));
        }
    });

    it("should be that default values are set correctly with parking deploy", async () => {
        const { factory, nft721, alice, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 7, royaltyVault.address, 13);
        const nft721_0 = await getNFT721(factory);

        expect(await nft721_0.PERMIT_TYPEHASH()).to.be.equal(
            convertToHash("Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)")
        );
        expect(await nft721_0.PERMIT_ALL_TYPEHASH()).to.be.equal(
            convertToHash("Permit(address owner,address spender,uint256 nonce,uint256 deadline)")
        );
        expect(await nft721_0.DOMAIN_SEPARATOR()).to.be.equal(
            await domainSeparator(ethers.provider, "Name", nft721_0.address)
        );
        expect(await nft721_0.factory()).to.be.equal(factory.address);

        async function URI721(nft: NFT721V2, tokenId: number): Promise<string> {
            const baseURI = await factory.baseURI721();
            const addy = nft.address.toLowerCase();
            return toUtf8String(
                solidityPack(
                    ["string", "string", "string", "string", "string"],
                    [baseURI, addy, "/", tokenId.toString(), ".json"]
                )
            );
        }

        expect(await nft721_0.tokenURI(0)).to.be.equal(await URI721(nft721_0, 0));
        expect(await nft721_0.tokenURI(3)).to.be.equal(await URI721(nft721_0, 3));
        expect(await nft721_0.tokenURI(6)).to.be.equal(await URI721(nft721_0, 6));
        await expect(nft721_0.tokenURI(7)).to.be.revertedWith("SHOYU: INVALID_TOKEN_ID");

        expect((await nft721_0.royaltyInfo(0, 0))[0]).to.be.equal(royaltyVault.address);

        expect((await nft721_0.royaltyInfo(0, 12345))[1]).to.be.equal(Math.floor((12345 * 13) / 1000));

        for (let i = 0; i <= 6; i++) {
            assert.isTrue(await nft721_0.parked(i));
        }
        assert.isFalse(await nft721_0.parked(7));
        assert.isFalse(await nft721_0.parked(8));
        assert.isFalse(await nft721_0.parked(9));
        assert.isFalse(await nft721_0.parked(10));
    });

    it("should be that permit/permitAll fuctions work well", async () => {
        const { factory, nft721, alice, bob, carol, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        const artist = ethers.Wallet.createRandom();

        await factory.deployNFT721AndMintBatch(artist.address, "Name", "Symbol", [0, 1, 2], royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        const currentTime = await getBlockTimestamp();
        let deadline = currentTime + 100;
        const permitDigest0 = await getDigest(
            ethers.provider,
            "Name",
            nft721_0.address,
            getHash(
                ["bytes32", "address", "uint256", "uint256", "uint256"],
                [await nft721_0.PERMIT_TYPEHASH(), bob.address, 1, 0, deadline]
            )
        );
        const { v: v0, r: r0, s: s0 } = sign(permitDigest0, artist);

        expect(await nft721_0.getApproved(1)).to.be.equal(AddressZero);
        await nft721_0.permit(bob.address, 1, deadline, v0, r0, s0);
        expect(await nft721_0.getApproved(1)).to.be.equal(bob.address);

        const { v: v1, r: r1, s: s1 } = sign(
            await getDigest(
                ethers.provider,
                "Name",
                nft721_0.address,
                getHash(
                    ["bytes32", "address", "uint256", "uint256", "uint256"],
                    [await nft721_0.PERMIT_TYPEHASH(), bob.address, 2, 1, deadline]
                )
            ),
            artist
        );

        const { v: fv0, r: fr0, s: fs0 } = sign(
            await getDigest(
                ethers.provider,
                "Name",
                nft721_0.address,
                getHash(
                    ["bytes32", "address", "uint256", "uint256", "uint256"],
                    [await nft721_0.PERMIT_TYPEHASH(), bob.address, 2, 5, deadline] //invalid nonce
                )
            ),
            artist
        );
        const { v: fv1, r: fr1, s: fs1 } = sign(
            await getDigest(
                ethers.provider,
                "Name",
                nft721_0.address,
                getHash(
                    ["bytes32", "address", "uint256", "uint256", "uint256"],
                    [await nft721_0.PERMIT_TYPEHASH(), bob.address, 2, 1, deadline - 120] //deadline over
                )
            ),
            artist
        );
        const fakeSigner = ethers.Wallet.createRandom();
        const { v: fv2, r: fr2, s: fs2 } = sign(
            await getDigest(
                ethers.provider,
                "Name",
                nft721_0.address,
                getHash(
                    ["bytes32", "address", "uint256", "uint256", "uint256"],
                    [await nft721_0.PERMIT_TYPEHASH(), bob.address, 2, 1, deadline] //fake signer
                )
            ),
            fakeSigner
        );

        await expect(nft721_0.permit(bob.address, 2, deadline, fv0, fr0, fs0)).to.be.revertedWith(
            "SHOYU: UNAUTHORIZED"
        ); //invalid nonce
        await expect(nft721_0.permit(bob.address, 2, deadline - 150, fv1, fr1, fs1)).to.be.revertedWith(
            "SHOYU: EXPIRED"
        ); //deadline over
        await expect(nft721_0.permit(bob.address, 5, deadline, v1, r1, s1)).to.be.revertedWith(
            "SHOYU: INVALID_TOKENID"
        ); //wrong id
        await expect(nft721_0.permit(carol.address, 2, deadline, v1, r1, s1)).to.be.revertedWith("SHOYU: UNAUTHORIZED"); //wrong spender
        await expect(nft721_0.permit(bob.address, 2, deadline, fv2, fr2, fs2)).to.be.revertedWith(
            "SHOYU: UNAUTHORIZED"
        ); //fake signer

        const permitAllDigest0 = await getDigest(
            ethers.provider,
            "Name",
            nft721_0.address,
            getHash(
                ["bytes32", "address", "address", "uint256", "uint256"],
                [await nft721_0.PERMIT_ALL_TYPEHASH(), artist.address, carol.address, 0, deadline]
            )
        );
        const { v: v2, r: r2, s: s2 } = sign(permitAllDigest0, artist);

        expect(await nft721_0.isApprovedForAll(artist.address, carol.address)).to.be.false;

        await expect(nft721_0.permitAll(artist.address, alice.address, deadline, v2, r2, s2)).to.be.revertedWith(
            "SHOYU: UNAUTHORIZED"
        );
        await nft721_0.permitAll(artist.address, carol.address, deadline, v2, r2, s2);

        expect(await nft721_0.isApprovedForAll(artist.address, carol.address)).to.be.true;
    });

    it("should be that owner can only decrease royalty fee", async () => {
        const { factory, nft721, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 7, royaltyVault.address, 20);
        const nft721_0 = await getNFT721(factory);

        await expect(nft721_0.setRoyaltyFee(10)).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(alice).setRoyaltyFee(30)).to.be.revertedWith("SHOYU: INVALID_FEE");
        await nft721_0.connect(alice).setRoyaltyFee(3);
        expect((await nft721_0.royaltyInfo(0, 1000))[1]).to.be.equal(3);
        await nft721_0.connect(alice).setRoyaltyFee(0);
        expect((await nft721_0.royaltyInfo(0, 1000))[1]).to.be.equal(0);
        await expect(nft721_0.connect(alice).setRoyaltyFee(1)).to.be.revertedWith("SHOYU: INVALID_FEE");

        await factory.deployNFT721AndMintBatch(bob.address, "Name", "Symbol", [9, 11], royaltyVault.address, 0);
        const nft721_1 = await getNFT721(factory);
        expect((await nft721_1.royaltyInfo(0, 1000))[1]).to.be.equal(0);
        await expect(nft721_1.connect(bob).setRoyaltyFee(251)).to.be.revertedWith("SHOYU: INVALID_FEE");
        await nft721_1.connect(bob).setRoyaltyFee(93);
        expect((await nft721_1.royaltyInfo(0, 1000))[1]).to.be.equal(93);
        await expect(nft721_1.connect(bob).setRoyaltyFee(111)).to.be.revertedWith("SHOYU: INVALID_FEE");
        await nft721_1.connect(bob).setRoyaltyFee(0);
        expect((await nft721_1.royaltyInfo(0, 1000))[1]).to.be.equal(0);
        await expect(nft721_1.connect(bob).setRoyaltyFee(1)).to.be.revertedWith("SHOYU: INVALID_FEE");
    });

    it("should be that URI functions work well", async () => {
        const { factory, nft721, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        async function URI721(nft: NFT721V2, tokenId: number, _baseURI?: string): Promise<string> {
            if (_baseURI === undefined) {
                const baseURI = await factory.baseURI721();
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

        await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 10, royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        await expect(nft721_0.connect(bob).setTokenURI(0, "https://foo.bar/0.json")).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );
        await nft721_0.connect(alice).setTokenURI(0, "https://foo.bar/0.json");
        await nft721_0.connect(alice).setTokenURI(1, "https://foo.bar/1.json");

        expect(await nft721_0.tokenURI(0)).to.be.equal("https://foo.bar/0.json");
        expect(await nft721_0.tokenURI(1)).to.be.equal("https://foo.bar/1.json");

        expect(await nft721_0.tokenURI(2)).to.be.equal(await URI721(nft721_0, 2));
        expect(await nft721_0.tokenURI(4)).to.be.equal(await URI721(nft721_0, 4));
        expect(await nft721_0.tokenURI(7)).to.be.equal(await URI721(nft721_0, 7));
        expect(await nft721_0.tokenURI(2)).to.be.not.equal(await URI721(nft721_0, 2, "https://foo.bar/"));
        expect(await nft721_0.tokenURI(4)).to.be.not.equal(await URI721(nft721_0, 4, "https://foo.bar/"));
        expect(await nft721_0.tokenURI(7)).to.be.not.equal(await URI721(nft721_0, 7, "https://foo.bar/"));

        await expect(nft721_0.connect(bob).setBaseURI("https://foo.bar/")).to.be.revertedWith("SHOYU: FORBIDDEN");
        await nft721_0.connect(alice).setBaseURI("https://foo.bar/");

        expect(await nft721_0.tokenURI(2)).to.be.equal(await URI721(nft721_0, 2, "https://foo.bar/"));
        expect(await nft721_0.tokenURI(4)).to.be.equal(await URI721(nft721_0, 4, "https://foo.bar/"));
        expect(await nft721_0.tokenURI(7)).to.be.equal(await URI721(nft721_0, 7, "https://foo.bar/"));
        expect(await nft721_0.tokenURI(2)).to.be.not.equal(await URI721(nft721_0, 2));
        expect(await nft721_0.tokenURI(4)).to.be.not.equal(await URI721(nft721_0, 4));
        expect(await nft721_0.tokenURI(7)).to.be.not.equal(await URI721(nft721_0, 7));

        expect(await nft721_0.contractURI()).to.be.equal(`https://foo.bar/${nft721_0.address.toLowerCase()}.json`);
        await expect(nft721_0.connect(bob).setContractURI("https://foo.bar/contractUri/")).to.be.revertedWith("SHOYU: FORBIDDEN");
        await nft721_0.connect(alice).setContractURI("https://foo.bar/contractUri/");
        expect(await nft721_0.contractURI()).to.be.equal("https://foo.bar/contractUri/");

        await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 10, royaltyVault.address, 10);
        const nft721_1 = await getNFT721(factory);
        expect(await nft721_1.contractURI()).to.be.equal(`https://nft721.sushi.com/${nft721_1.address.toLowerCase()}.json`);

    });

    it("should be that parkTokenIds func work well", async () => {
        const { factory, nft721, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 50, royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        await expect(nft721_0.connect(bob).parkTokenIds(100)).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(alice).parkTokenIds(30)).to.be.revertedWith("SHOYU: INVALID_TO_TOKEN_ID");
        await expect(nft721_0.connect(alice).parkTokenIds(50)).to.be.revertedWith("SHOYU: INVALID_TO_TOKEN_ID");
        await nft721_0.connect(alice).parkTokenIds(51);
        await nft721_0.connect(alice).parkTokenIds(100);
    });

    it("should be that mint/mintBatch functions work well", async () => {
        const { factory, nft721, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(bob.address, "Name", "Symbol", [0, 2, 4], royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        await expect(nft721_0.mint(alice.address, 1, [])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(bob).mint(alice.address, 0, [])).to.be.revertedWith("SHOYU: ALREADY_MINTED");
        await expect(nft721_0.connect(bob).mint(AddressZero, 1, [])).to.be.revertedWith("SHOYU: INVALID_TO");
        await expect(nft721_0.connect(bob).mint(factory.address, 1, [])).to.be.revertedWith("SHOYU: INVALID_RECEIVER");

        await nft721_0.connect(bob).mint(alice.address, 1, []); //0,1,2,4 are minted

        await expect(nft721_0.mintBatch(alice.address, [3, 5], [])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(bob).mintBatch(alice.address, [3, 4], [])).to.be.revertedWith(
            "SHOYU: ALREADY_MINTED"
        );
        await expect(nft721_0.connect(bob).mintBatch(AddressZero, [3, 5], [])).to.be.revertedWith("SHOYU: INVALID_TO");
        await expect(nft721_0.connect(bob).mintBatch(factory.address, [3, 5], [])).to.be.revertedWith(
            "SHOYU: INVALID_RECEIVER"
        );

        await nft721_0.connect(bob).mint(alice.address, [3, 5], []); //0,1,2,3,4,5 are minted

        await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 50, royaltyVault.address, 10);
        const nft721_1 = await getNFT721(factory); //nothing is minted. 0-49 are parked

        await expect(nft721_1.mint(bob.address, 1, [])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_1.connect(alice).mint(AddressZero, 1, [])).to.be.revertedWith("SHOYU: INVALID_TO");
        await expect(nft721_1.connect(alice).mint(factory.address, 1, [])).to.be.revertedWith(
            "SHOYU: INVALID_RECEIVER"
        );

        await nft721_1.connect(alice).mint(bob.address, 1, []);
        await nft721_1.connect(alice).mint(bob.address, 50, []); //1,50 are minted. 0-49 are parked

        await expect(nft721_1.mintBatch(bob.address, [3, 5, 7], [])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_1.connect(alice).mintBatch(bob.address, [1, 5, 7], [])).to.be.revertedWith(
            "SHOYU: ALREADY_MINTED"
        );
        await expect(nft721_1.connect(alice).mintBatch(AddressZero, [3, 5, 7], [])).to.be.revertedWith(
            "SHOYU: INVALID_TO"
        );
        await expect(nft721_1.connect(alice).mintBatch(factory.address, [3, 5, 7], [])).to.be.revertedWith(
            "SHOYU: INVALID_RECEIVER"
        );

        await nft721_1.connect(alice).mint(bob.address, [3, 5, 7], []); //1,3,5,7,50 are minted. 0-49 are parked
        await nft721_1.connect(alice).mint(bob.address, [40, 55], []); //1,3,5,7,40,50,55 are minted. 0-49 are parked
        await nft721_1.connect(alice).mint(bob.address, [80, 100], []); //1,3,5,7,40,50,55,80,100 are minted. 0-49 are parked
    });

    it("should be that burn/burnBatch functions work well", async () => {
        const { factory, nft721, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(
            bob.address,
            "Name",
            "Symbol",
            [0, 2, 4, 6, 8, 10],
            royaltyVault.address,
            10
        );
        const nft721_0 = await getNFT721(factory);
        await nft721_0.connect(bob).transferFrom(bob.address, alice.address, 6);
        await nft721_0.connect(bob).transferFrom(bob.address, alice.address, 8);
        await nft721_0.connect(bob).transferFrom(bob.address, alice.address, 10);
        //bob : owner & 0,2,4 _  alice : notOwner & 6,8,10

        await expect(nft721_0.connect(bob).burn(6, 0, HashZero)).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(alice).burn(4, 0, HashZero)).to.be.revertedWith("SHOYU: FORBIDDEN");
        await nft721_0.connect(bob).burn(0, 0, HashZero); //0 is burned

        await expect(nft721_0.connect(bob).burn(0, 0, HashZero)).to.be.revertedWith("SHOYU: FORBIDDEN");

        await nft721_0.connect(alice).burn(6, 0, HashZero); //0,6 is burned

        //bob : owner & 2,4 _  alice : notOwner & 8,10
        await expect(nft721_0.connect(bob).burnBatch([2, 3])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(bob).burnBatch([2, 8])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(bob).burnBatch([3, 8])).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(bob).burnBatch([8, 10])).to.be.revertedWith("SHOYU: FORBIDDEN");

        await nft721_0.connect(alice).burnBatch([8, 10]);
        await nft721_0.connect(bob).burnBatch([2]);
    });

    it("should be that static call functions work properly", async () => {
        const { factory, nft721, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(
            bob.address,
            "Name",
            "Symbol",
            [0, 2, 4, 6, 8, 10],
            royaltyVault.address,
            10
        );
        const nft721_0 = await getNFT721(factory);

        expect(await nft721_0.target()).to.be.equal(AddressZero);
        
        const StaticCallMock = await ethers.getContractFactory("StaticCallMock");
        const target0 = (await StaticCallMock.deploy()) as StaticCallMock;

        let proxyNFT = (await StaticCallMock.attach(nft721_0.address)) as StaticCallMock;
        await expect(proxyNFT.globalV()).to.be.reverted;
        await expect(proxyNFT.pureTest11(1)).to.be.reverted;

        await expect(nft721_0.setTarget(target0.address)).to.be.revertedWith("SHOYU: FORBIDDEN");
        await nft721_0.connect(bob).setTarget(target0.address);
        expect(await nft721_0.target()).to.be.equal(target0.address);

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

describe("Exchange part of NFT721", () => {
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
    async function checkEvent(contract: Contract, eventName: string, args: any[]) {
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

    it("should be that the cancel function works well", async () => {
        const { factory, nft721, royaltyVault, erc20Mock, englishAuction } = await setupTest();

        const { alice, bob, carol } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(alice.address, "Name", "Symbol", [0, 1, 2], royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);
        await nft721_0.connect(alice).transferFrom(alice.address, bob.address, 1);
        await nft721_0.connect(alice).transferFrom(alice.address, carol.address, 2);

        await factory.setStrategyWhitelisted(englishAuction.address, true);
        const currentTime = await getBlockTimestamp();
        const deadline0 = currentTime + 100;
        expect(await nft721_0.ownerOf(0)).to.be.equal(alice.address);
        const askOrder0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256"], [0, currentTime])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            bob,
            AddressZero,
            nft721_0.address,
            1,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256"], [0, currentTime])
        );

        await expect(nft721_0.connect(bob).cancel(askOrder0.order)).to.be.revertedWith("SHOYU: FORBIDDEN");

        await expect(nft721_0.connect(alice).cancel(askOrder1.order)).to.be.revertedWith("SHOYU: FORBIDDEN");

        expect(await nft721_0.connect(alice).cancel(askOrder0.order));

        expect(await nft721_0.connect(bob).cancel(askOrder1.order));

        const askOrder2 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            carol,
            AddressZero,
            nft721_0.address,
            2,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );

        expect((await nft721_0.bestBid(askOrder2.hash))[0]).to.be.equal(AddressZero);
        await bid2(nft721_0, bob, askOrder2.order, 1, 100, AddressZero);

        expect((await nft721_0.bestBid(askOrder2.hash))[0]).to.be.equal(bob.address);

        await expect(nft721_0.connect(carol).cancel(askOrder2.order)).to.be.revertedWith("SHOYU: BID_EXISTS");
    });

    it("should be that the claim function can be called by anyone", async () => {
        const { factory, nft721, royaltyVault, erc20Mock, englishAuction } = await setupTest();

        const { alice, bob, carol, dan } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(alice.address, "Name", "Symbol", [0, 1, 2], royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);
        await nft721_0.connect(alice).transferFrom(alice.address, bob.address, 1);

        await factory.setStrategyWhitelisted(englishAuction.address, true);
        const currentTime = await getBlockTimestamp();
        const deadline0 = currentTime + 100;
        expect(await nft721_0.ownerOf(0)).to.be.equal(alice.address);

        await erc20Mock.mint(carol.address, 10000);
        await erc20Mock.mint(dan.address, 10000);
        await erc20Mock.connect(carol).approve(nft721_0.address, 10000);
        await erc20Mock.connect(dan).approve(nft721_0.address, 10000);

        const askOrder0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            bob,
            AddressZero,
            nft721_0.address,
            1,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        const askOrder2 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            2,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );

        await bid2(nft721_0, carol, askOrder0.order, 1, 100, AddressZero);
        expect((await nft721_0.bestBid(askOrder0.hash))[0]).to.be.equal(carol.address);
        expect((await nft721_0.bestBid(askOrder0.hash))[2]).to.be.equal(100);

        await bid2(nft721_0, dan, askOrder1.order, 1, 300, AddressZero);
        expect((await nft721_0.bestBid(askOrder1.hash))[0]).to.be.equal(dan.address);
        expect((await nft721_0.bestBid(askOrder1.hash))[2]).to.be.equal(300);

        await bid2(nft721_0, dan, askOrder2.order, 1, 500, AddressZero);
        expect((await nft721_0.bestBid(askOrder2.hash))[0]).to.be.equal(dan.address);
        expect((await nft721_0.bestBid(askOrder2.hash))[2]).to.be.equal(500);

        await mine(100);
        assert.isTrue(deadline0 < (await getBlockTimestamp()));

        //nft0 : seller-Alice / buyer-Carol. Dan can claim.
        expect(await nft721_0.connect(dan).claim(askOrder0.order)).to.emit(nft721_0, "Claim");
        expect(await nft721_0.ownerOf(0)).to.be.equal(carol.address);
        expect(await erc20Mock.balanceOf(carol.address)).to.be.equal(9900);

        //nft1 : seller-Bob / buyer-Dan.  Seller Bob can claim.
        expect(await nft721_0.connect(bob).claim(askOrder1.order)).to.emit(nft721_0, "Claim");
        expect(await nft721_0.ownerOf(1)).to.be.equal(dan.address);
        expect(await erc20Mock.balanceOf(dan.address)).to.be.equal(9700);

        //nft2 : seller-Alice / buyer-Dan.  Buyer Dan can claim.
        expect(await nft721_0.connect(dan).claim(askOrder2.order)).to.emit(nft721_0, "Claim");
        expect((await nft721_0.bestBid(askOrder2.hash))[0]).to.be.equal(AddressZero);
        expect(await nft721_0.ownerOf(2)).to.be.equal(dan.address);
        expect(await erc20Mock.balanceOf(dan.address)).to.be.equal(9200);
    });

    it("should be that the claim function will be reverted if BestBid is not exist", async () => {
        const {
            factory,
            nft721,
            royaltyVault,
            erc20Mock,
            englishAuction,
            dutchAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, proxy } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(alice.address, "Name", "Symbol", [0, 1, 2, 3], royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        await factory.setStrategyWhitelisted(englishAuction.address, true);
        await factory.setStrategyWhitelisted(dutchAuction.address, true);
        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline0 = currentTime + 100;
        const askOrder0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
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
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            2,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime])
        );
        const askOrder3 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            proxy.address,
            nft721_0.address,
            3,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline0,
            defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime])
        );

        expect((await nft721_0.bestBid(askOrder0.hash))[0]).to.be.equal(AddressZero);
        expect((await nft721_0.bestBid(askOrder1.hash))[0]).to.be.equal(AddressZero);
        expect((await nft721_0.bestBid(askOrder2.hash))[0]).to.be.equal(AddressZero);
        expect((await nft721_0.bestBid(askOrder3.hash))[0]).to.be.equal(AddressZero);

        await expect(nft721_0.claim(askOrder3.order)).to.be.revertedWith("SHOYU: FAILURE");

        await expect(nft721_0.claim(askOrder2.order)).to.be.revertedWith("SHOYU: FAILURE");

        await expect(nft721_0.claim(askOrder1.order)).to.be.revertedWith("SHOYU: FAILURE");

        await expect(nft721_0.claim(askOrder0.order)).to.be.revertedWith("SHOYU: FAILURE");
        assert.isFalse(deadline0 < (await getBlockTimestamp()));
        assert.isFalse(await nft721_0.isCancelledOrClaimed(askOrder0.hash));
        expect(await nft721_0.ownerOf(0)).to.be.equal(alice.address);

        await mine(100);
        assert.isTrue(deadline0 < (await getBlockTimestamp()));
        await expect(nft721_0.claim(askOrder0.order)).to.be.revertedWith("SHOYU: FAILED_TO_TRANSFER_FUNDS");
        assert.isFalse(await nft721_0.isCancelledOrClaimed(askOrder0.hash));
        expect(await nft721_0.ownerOf(0)).to.be.equal(alice.address);
    });

    it("should be that fees are transfered properly", async () => {
        const {
            factory,
            operationalVault,
            protocolVault,
            nft721,
            royaltyVault,
            erc20Mock,
            englishAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank, proxy } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(alice.address, "Name", "Symbol", [0, 1, 2, 3], royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        await factory.setStrategyWhitelisted(englishAuction.address, true);
        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.connect(bob).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(carol).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(dan).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(erin).approve(nft721_0.address, 10000000);

        //protocol 25 operator 5 royalty 10
        const askOrder0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            1,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [12345, currentTime])
        );
        const askOrder2 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            proxy.address,
            nft721_0.address,
            2,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            currentTime + 5,
            defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime])
        );
        const askOrder3 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            3,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [15000, currentTime])
        );

        await bid2(nft721_0, bob, askOrder0.order, 1, 100, AddressZero);
        await checkEvent(nft721_0, "Bid", [askOrder0.hash, bob.address, 1, 100, AddressZero, AddressZero]);

        const fees0 = fees(12345, 25, 5, 10);
        await expect(() => bid2(nft721_0, carol, askOrder1.order, 1, 12345, AddressZero)).to.changeTokenBalances(
            erc20Mock,
            [carol, protocolVault, operationalVault, royaltyVault, alice],
            [-12345, fees0[0], fees0[1], fees0[2], fees0[3]]
        );

        await erc20Mock.connect(dan).approve(proxy.address, 10000000);
        const bidOrder2 = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrder2.hash,
            dan,
            1,
            31313,
            dan.address,
            AddressZero
        );
        const fees1 = fees(31313, 25, 5, 10);
        await expect(() => bid1(nft721_0, proxy, askOrder2.order, bidOrder2.order)).to.changeTokenBalances(
            erc20Mock,
            [dan, protocolVault, operationalVault, royaltyVault, alice, frank, proxy],
            [-31313, fees1[0], fees1[1], fees1[2], fees1[3], 0, 0]
        );

        await factory.setProtocolFeeRecipient(erin.address);
        await factory.setOperationalFeeRecipient(frank.address);
        await factory.setOperationalFee(17);
        await nft721_0.connect(alice).setRoyaltyFeeRecipient(carol.address);
        await nft721_0.connect(alice).setRoyaltyFee(4);

        //erin 25/1000 frank 17/1000 carol 4/1000
        const fees2 = fees(15000, 25, 17, 4);
        await expect(() => bid2(nft721_0, dan, askOrder3.order, 1, 15000, AddressZero)).to.changeTokenBalances(
            erc20Mock,
            [dan, erin, frank, carol, alice, protocolVault, operationalVault, royaltyVault],
            [-15000, fees2[0], fees2[1], fees2[2], fees2[3], 0, 0, 0]
        );

        await mine(100);

        const fees3 = fees(100, 25, 17, 4);
        assert.isTrue(deadline < (await getBlockTimestamp()));
        await expect(() => nft721_0.claim(askOrder0.order)).to.changeTokenBalances(
            erc20Mock,
            [bob, erin, frank, carol, alice, protocolVault, operationalVault, royaltyVault],
            [-100, fees3[0], fees3[1], fees3[2], fees3[3], 0, 0, 0]
        );

        await factory.deployNFT721AndMintBatch(alice.address, "Name2", "Symbol2", [0], royaltyVault.address, 0);
        const nft721_1 = await getNFT721(factory);

        const askOrder4 = await signAsk(
            ethers.provider,
            "Name2",
            nft721_1.address,
            alice,
            AddressZero,
            nft721_1.address,
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
        await erc20Mock.connect(dan).approve(nft721_1.address, 10000000);
        await expect(() => bid2(nft721_1, dan, askOrder4.order, 1, 11000, AddressZero)).to.changeTokenBalances(
            erc20Mock,
            [dan, erin, frank, carol, alice, protocolVault, operationalVault, royaltyVault],
            [-11000, fees4[0], fees4[1], fees4[2], fees4[3], 0, 0, 0]
        );
        expect(fees4[2]).to.be.equal(0);
    });

    it("should be that parked tokens are minted automatically when they are claimed", async () => {
        const {
            factory,
            nft721,
            royaltyVault,
            erc20Mock,
            englishAuction,
            dutchAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank, proxy } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 10, royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        await factory.setStrategyWhitelisted(englishAuction.address, true);
        await factory.setStrategyWhitelisted(dutchAuction.address, true);
        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(bob).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(carol).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(dan).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(erin).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(frank).approve(nft721_0.address, 10000000);

        const askOrder0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
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
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            2,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime])
        );
        const askOrder3 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            proxy.address,
            nft721_0.address,
            3,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime])
        );
        const askOrder4 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            10,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime])
        );

        expect(await nft721_0.parked(0)).to.be.true;
        expect(await nft721_0.parked(1)).to.be.true;
        expect(await nft721_0.parked(2)).to.be.true;
        expect(await nft721_0.parked(3)).to.be.true;
        expect(await nft721_0.parked(10)).to.be.false;

        await bid2(nft721_0, bob, askOrder0.order, 1, 100, AddressZero);
        await checkEvent(nft721_0, "Bid", [askOrder0.hash, bob.address, 1, 100, AddressZero, AddressZero]);

        expect(await nft721_0.ownerOf(1)).to.be.equal(AddressZero);
        await bid2(nft721_0, carol, askOrder1.order, 1, 999, AddressZero);
        expect(await nft721_0.ownerOf(1)).to.be.equal(carol.address);

        expect(await nft721_0.ownerOf(2)).to.be.equal(AddressZero);
        await bid2(nft721_0, dan, askOrder2.order, 1, 100, AddressZero);
        expect(await nft721_0.ownerOf(2)).to.be.equal(dan.address);

        expect(await nft721_0.ownerOf(3)).to.be.equal(AddressZero);
        await erc20Mock.connect(dan).approve(proxy.address, 1000);
        const bidOrder3 = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrder3.hash,
            dan,
            1,
            100,
            dan.address,
            AddressZero
        );
        await bid1(nft721_0, proxy, askOrder3.order, bidOrder3.order);
        expect(await nft721_0.ownerOf(3)).to.be.equal(dan.address);

        expect(await nft721_0.ownerOf(10)).to.be.equal(AddressZero);
        expect(await nft721_0.parked(10)).to.be.false;
        await expect(bid2(nft721_0, erin, askOrder4.order, 1, 100, AddressZero)).to.be.revertedWith(
            "SHOYU: TRANSFER_FORBIDDEN"
        );

        await mine(100);
        expect(await nft721_0.ownerOf(0)).to.be.equal(AddressZero);
        await nft721_0.claim(askOrder0.order);
        expect(await nft721_0.ownerOf(0)).to.be.equal(bob.address);

        assert.isFalse(await nft721_0.parked(0));
        assert.isFalse(await nft721_0.parked(1));
        assert.isFalse(await nft721_0.parked(2));
        assert.isFalse(await nft721_0.parked(3));

        assert.isTrue(await nft721_0.parked(4));
        assert.isTrue(await nft721_0.parked(5));
        assert.isTrue(await nft721_0.parked(6));
        assert.isTrue(await nft721_0.parked(7));
        assert.isTrue(await nft721_0.parked(8));
        assert.isTrue(await nft721_0.parked(9));

        assert.isFalse(await nft721_0.parked(10));
        assert.isFalse(await nft721_0.parked(11));
        assert.isFalse(await nft721_0.parked(12));
    });

    it("should be that NFT tokens can be traded on itself not others", async () => {
        const { factory, nft721, royaltyVault, erc721Mock, erc20Mock, fixedPriceSale } = await setupTest();

        const { alice, bob, carol } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(alice.address, "Name", "Symbol", [0, 1, 2, 3], royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        await factory.deployNFT721AndMintBatch(
            alice.address,
            "Name2",
            "Symbol2",
            [0, 1, 2, 3],
            royaltyVault.address,
            10
        );
        const nft721_1 = await getNFT721(factory);

        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.connect(bob).approve(nft721_0.address, 10000000);

        const askOrder0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_1.address,
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
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            erc721Mock.address,
            0,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );

        assert.isFalse(await nft721_0.canTrade(nft721_1.address));
        assert.isFalse(await nft721_0.canTrade(erc721Mock.address));

        await expect(bid2(nft721_0, bob, askOrder0.order, 1, 100, AddressZero)).to.be.revertedWith(
            "SHOYU: INVALID_EXCHANGE"
        );

        await expect(bid2(nft721_0, bob, askOrder1.order, 1, 100, AddressZero)).to.be.revertedWith(
            "SHOYU: INVALID_EXCHANGE"
        );
    });

    it("should be that claimed orders can't be used again even if it's back to the initial owner", async () => {
        const {
            factory,
            nft721,
            royaltyVault,
            erc20Mock,
            englishAuction,
            dutchAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank, proxy } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 10, royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        await factory.setStrategyWhitelisted(englishAuction.address, true);
        await factory.setStrategyWhitelisted(dutchAuction.address, true);
        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(bob).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(carol).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(dan).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(erin).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(frank).approve(nft721_0.address, 10000000);

        const askOrder0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
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
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            2,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime])
        );
        const askOrder3 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            proxy.address,
            nft721_0.address,
            3,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime])
        );

        await bid2(nft721_0, bob, askOrder0.order, 1, 100, AddressZero);
        await checkEvent(nft721_0, "Bid", [askOrder0.hash, bob.address, 1, 100, AddressZero, AddressZero]);

        await bid2(nft721_0, carol, askOrder1.order, 1, 999, AddressZero);

        await bid2(nft721_0, dan, askOrder2.order, 1, 100, AddressZero);

        await erc20Mock.connect(dan).approve(proxy.address, 10000);
        const bidOrder3 = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrder3.hash,
            dan,
            1,
            100,
            dan.address,
            AddressZero
        );
        await bid1(nft721_0, proxy, askOrder3.order, bidOrder3.order);
        await expect(bid2(nft721_0, carol, askOrder1.order, 1, 999, AddressZero)).to.be.revertedWith("SHOYU: SOLD_OUT");

        await expect(bid2(nft721_0, dan, askOrder2.order, 1, 100, AddressZero)).to.be.revertedWith("SHOYU: SOLD_OUT");
        const bidOrder3_ = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrder3.hash,
            dan,
            1,
            100,
            dan.address,
            AddressZero
        );
        await expect(bid1(nft721_0, proxy, askOrder3.order, bidOrder3_.order)).to.be.revertedWith("SHOYU: SOLD_OUT");

        await nft721_0.connect(carol).transferFrom(carol.address, alice.address, 1);
        await nft721_0.connect(dan).transferFrom(dan.address, alice.address, 2);
        await nft721_0.connect(dan).transferFrom(dan.address, alice.address, 3);

        await expect(bid2(nft721_0, carol, askOrder1.order, 1, 999, AddressZero)).to.be.revertedWith("SHOYU: SOLD_OUT");

        await expect(bid2(nft721_0, dan, askOrder2.order, 1, 100, AddressZero)).to.be.revertedWith("SHOYU: SOLD_OUT");

        await expect(bid1(nft721_0, proxy, askOrder3.order, bidOrder3_.order)).to.be.revertedWith("SHOYU: SOLD_OUT");

        await mine(100);
        await nft721_0.claim(askOrder0.order);

        await expect(bid2(nft721_0, bob, askOrder0.order, 1, 100, AddressZero)).to.be.revertedWith("SHOYU: SOLD_OUT");

        await nft721_0.connect(bob).transferFrom(bob.address, alice.address, 0);

        await expect(bid2(nft721_0, bob, askOrder0.order, 1, 100, AddressZero)).to.be.revertedWith("SHOYU: SOLD_OUT");
    });

    it("should be that BestBid is replaced if someone bid with higher price", async () => {
        const { factory, nft721, royaltyVault, erc20Mock, englishAuction } = await setupTest();

        const { alice, bob, carol, dan } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(alice.address, "Name", "Symbol", [0, 1, 2], royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);
        await nft721_0.connect(alice).transferFrom(alice.address, bob.address, 1);

        await factory.setStrategyWhitelisted(englishAuction.address, true);
        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        const askOrder0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );

        await bid2(nft721_0, bob, askOrder0.order, 1, 100, AddressZero);
        expect((await nft721_0.bestBid(askOrder0.hash))[0]).to.be.equal(bob.address);
        expect((await nft721_0.bestBid(askOrder0.hash))[1]).to.be.equal(1);
        expect((await nft721_0.bestBid(askOrder0.hash))[2]).to.be.equal(100);
        expect((await nft721_0.bestBid(askOrder0.hash))[3]).to.be.equal(AddressZero);
        expect((await nft721_0.bestBid(askOrder0.hash))[4]).to.be.equal(AddressZero);
        expect((await nft721_0.bestBid(askOrder0.hash))[5]).to.be.equal(await getBlockTimestamp());

        await mine(11);
        await bid2(nft721_0, carol, askOrder0.order, 1, 110, AddressZero);
        expect((await nft721_0.bestBid(askOrder0.hash))[0]).to.be.equal(carol.address);
        expect((await nft721_0.bestBid(askOrder0.hash))[1]).to.be.equal(1);
        expect((await nft721_0.bestBid(askOrder0.hash))[2]).to.be.equal(110);
        expect((await nft721_0.bestBid(askOrder0.hash))[3]).to.be.equal(AddressZero);
        expect((await nft721_0.bestBid(askOrder0.hash))[4]).to.be.equal(AddressZero);
        expect((await nft721_0.bestBid(askOrder0.hash))[5]).to.be.equal(await getBlockTimestamp());

        await mine(11);
        await expect(bid2(nft721_0, dan, askOrder0.order, 1, 110, AddressZero)).to.be.revertedWith("SHOYU: FAILURE");

        await erc20Mock.mint(carol.address, 10000);
        await erc20Mock.connect(carol).approve(nft721_0.address, 10000);

        await mine(100);
        expect(await nft721_0.claim(askOrder0.order)).to.emit(nft721_0, "Claim");
        expect(await nft721_0.ownerOf(0)).to.be.equal(carol.address);
        expect(await erc20Mock.balanceOf(carol.address)).to.be.equal(10000 - 110);
    });

    it("should be that bid(Orders.Ask memory askOrder, Orders.Bid memory bidOrder) function works well", async () => {
        const {
            factory,
            nft721,
            royaltyVault,
            erc20Mock,
            englishAuction,
            dutchAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 10, royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        await factory.setStrategyWhitelisted(englishAuction.address, true);
        await factory.setStrategyWhitelisted(dutchAuction.address, true);
        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(bob).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(carol).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(dan).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(erin).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(frank).approve(nft721_0.address, 10000000);

        const askOrder0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
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
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            2,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [100, currentTime])
        );

        const bidOrder0 = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrder0.hash,
            bob,
            1,
            101,
            AddressZero,
            AddressZero
        );
        const bidOrder1 = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrder1.hash,
            carol,
            1,
            990,
            AddressZero,
            AddressZero
        );
        const bidOrder2 = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrder2.hash,
            dan,
            1,
            100,
            AddressZero,
            AddressZero
        );

        await bid1(nft721_0, alice, askOrder1.order, bidOrder1.order);
        await checkEvent(nft721_0, "Claim", [askOrder1.hash, carol.address, 1, 990, carol.address, AddressZero]);

        await bid1(nft721_0, alice, askOrder2.order, bidOrder2.order);
        await checkEvent(nft721_0, "Claim", [askOrder2.hash, dan.address, 1, 100, dan.address, AddressZero]);

        await bid1(nft721_0, alice, askOrder0.order, bidOrder0.order);
        expect((await nft721_0.bestBid(askOrder0.hash))[0]).to.be.equal(bob.address);
        expect((await nft721_0.bestBid(askOrder0.hash))[1]).to.be.equal(1);
        expect((await nft721_0.bestBid(askOrder0.hash))[2]).to.be.equal(101);
        expect((await nft721_0.bestBid(askOrder0.hash))[3]).to.be.equal(AddressZero);
        expect((await nft721_0.bestBid(askOrder0.hash))[4]).to.be.equal(AddressZero);
        expect((await nft721_0.bestBid(askOrder0.hash))[5]).to.be.equal(await getBlockTimestamp());

        await mine(15);

        const bidOrder0_ = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrder0.hash,
            carol,
            1,
            111,
            AddressZero,
            AddressZero
        );

        await bid1(nft721_0, alice, askOrder0.order, bidOrder0_.order);
        expect((await nft721_0.bestBid(askOrder0.hash))[0]).to.be.equal(carol.address);
        expect((await nft721_0.bestBid(askOrder0.hash))[1]).to.be.equal(1);
        expect((await nft721_0.bestBid(askOrder0.hash))[2]).to.be.equal(111);
        expect((await nft721_0.bestBid(askOrder0.hash))[3]).to.be.equal(AddressZero);
        expect((await nft721_0.bestBid(askOrder0.hash))[4]).to.be.equal(AddressZero);
        expect((await nft721_0.bestBid(askOrder0.hash))[5]).to.be.equal(await getBlockTimestamp());
    });

    it("should be that fees and nft go to recipients if they are set in orders", async () => {
        const {
            factory,
            operationalVault,
            protocolVault,
            nft721,
            royaltyVault,
            erc20Mock,
            englishAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(alice.address, "Name", "Symbol", [0, 1, 2, 3], royaltyVault.address, 10);
        const nft721_0 = await getNFT721(factory);

        await factory.setStrategyWhitelisted(englishAuction.address, true);
        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);
        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(bob.address, 10000000);
        await erc20Mock.mint(carol.address, 10000000);
        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.connect(bob).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(carol).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(dan).approve(nft721_0.address, 10000000);

        //protocol 25 operator 5 royalty 10
        const askOrder0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            erin.address,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        const askOrder1 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            1,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            frank.address,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [12345, currentTime])
        );

        await bid2(nft721_0, bob, askOrder0.order, 1, 100, dan.address);
        await checkEvent(nft721_0, "Bid", [askOrder0.hash, bob.address, 1, 100, dan.address, AddressZero]);
        const fees0 = fees(12345, 25, 5, 10);

        await expect(() => bid2(nft721_0, carol, askOrder1.order, 1, 12345, bob.address)).to.changeTokenBalances(
            erc20Mock,
            [carol, protocolVault, operationalVault, royaltyVault, frank, alice],
            [-12345, fees0[0], fees0[1], fees0[2], fees0[3], 0]
        );
        expect(await nft721_0.ownerOf(1)).to.be.equal(bob.address);

        await mine(100);

        const fees1 = fees(100, 25, 5, 10);
        await expect(() => nft721_0.claim(askOrder0.order)).to.changeTokenBalances(
            erc20Mock,
            [bob, protocolVault, operationalVault, royaltyVault, erin, alice],
            [-100, fees1[0], fees1[1], fees1[2], fees1[3], 0]
        );
        expect(await nft721_0.ownerOf(0)).to.be.equal(dan.address);
    });

    it("should be that bid and claim functions work properly with proxy", async () => {
        const {
            factory,
            nft721,
            royaltyVault,
            erc20Mock,
            englishAuction,
            dutchAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank, proxy } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(
            alice.address,
            "Name",
            "Symbol",
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            royaltyVault.address,
            10
        );
        const nft721_0 = await getNFT721(factory);

        await factory.setStrategyWhitelisted(englishAuction.address, true);
        await factory.setStrategyWhitelisted(dutchAuction.address, true);
        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(dan).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(erin).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(frank).approve(nft721_0.address, 10000000);

        const askOrderEwithP = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            proxy.address,
            nft721_0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            currentTime + 30,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        const askOrderEwithoutP = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            1,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            currentTime + 30,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );

        const askOrderFwithP = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            proxy.address,
            nft721_0.address,
            2,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [200, currentTime])
        );
        const askOrderFwithoutP = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            3,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [201, currentTime])
        );

        const askOrderDwithP = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            proxy.address,
            nft721_0.address,
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
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
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
            "Name",
            nft721_0.address,
            askOrderEwithP.hash,
            dan,
            1,
            100,
            AddressZero,
            AddressZero
        );
        const bidOrderEwithoutP = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrderEwithoutP.hash,
            dan,
            1,
            101,
            AddressZero,
            AddressZero
        );

        await expect(bid1(nft721_0, bob, askOrderEwithP.order, bidOrderEwithP.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );
        await expect(bid1(nft721_0, proxy, askOrderEwithP.order, bidOrderEwithP.order)).to.be.revertedWith(
            "SHOYU: FAILURE"
        );

        await bid1(nft721_0, bob, askOrderEwithoutP.order, bidOrderEwithoutP.order);
        await checkEvent(nft721_0, "Bid", [askOrderEwithoutP.hash, dan.address, 1, 101, AddressZero, AddressZero]);

        await mine(30);
        await expect(nft721_0.connect(carol).claim(askOrderEwithP.order)).to.be.revertedWith("SHOYU: FAILURE");
        await bid1(nft721_0, proxy, askOrderEwithP.order, bidOrderEwithP.order);
        await checkEvent(nft721_0, "Claim", [askOrderEwithP.hash, dan.address, 1, 100, dan.address, AddressZero]);

        expect(await nft721_0.connect(carol).claim(askOrderEwithoutP.order)).to.emit(nft721_0, "Claim");
        expect(await nft721_0.ownerOf(0)).to.be.equal(dan.address);
        expect(await nft721_0.ownerOf(1)).to.be.equal(dan.address);

        const bidOrderFwithP = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrderFwithP.hash,
            erin,
            1,
            200,
            AddressZero,
            AddressZero
        );
        const bidOrderFwithoutP = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrderFwithoutP.hash,
            erin,
            1,
            201,
            AddressZero,
            AddressZero
        );

        await expect(bid1(nft721_0, bob, askOrderFwithP.order, bidOrderFwithP.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );
        await bid1(nft721_0, proxy, askOrderFwithP.order, bidOrderFwithP.order);
        await checkEvent(nft721_0, "Claim", [askOrderFwithP.hash, erin.address, 1, 200, erin.address, AddressZero]);

        await bid1(nft721_0, bob, askOrderFwithoutP.order, bidOrderFwithoutP.order);
        await checkEvent(nft721_0, "Claim", [askOrderFwithoutP.hash, erin.address, 1, 201, erin.address, AddressZero]);
        expect(await nft721_0.ownerOf(2)).to.be.equal(erin.address);
        expect(await nft721_0.ownerOf(3)).to.be.equal(erin.address);

        const bidOrderDwithP = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrderDwithP.hash,
            frank,
            1,
            990,
            AddressZero,
            AddressZero
        );
        const bidOrderDwithoutP = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrderDwithoutP.hash,
            frank,
            1,
            980,
            AddressZero,
            AddressZero
        );

        await expect(bid1(nft721_0, bob, askOrderDwithP.order, bidOrderDwithP.order)).to.be.revertedWith(
            "SHOYU: FORBIDDEN"
        );
        await bid1(nft721_0, proxy, askOrderDwithP.order, bidOrderDwithP.order);
        await checkEvent(nft721_0, "Claim", [askOrderDwithP.hash, frank.address, 1, 990, frank.address, AddressZero]);

        await bid1(nft721_0, bob, askOrderDwithoutP.order, bidOrderDwithoutP.order);
        await checkEvent(nft721_0, "Claim", [
            askOrderDwithoutP.hash,
            frank.address,
            1,
            980,
            frank.address,
            AddressZero,
        ]);

        expect(await nft721_0.ownerOf(4)).to.be.equal(frank.address);
        expect(await nft721_0.ownerOf(5)).to.be.equal(frank.address);

        const askOrderFwithP1 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            proxy.address,
            nft721_0.address,
            6,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [200, currentTime])
        );
        const askOrderFwithoutP1 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
            7,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [201, currentTime])
        );

        const askOrderDwithP1 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            proxy.address,
            nft721_0.address,
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
            "Name",
            nft721_0.address,
            alice,
            AddressZero,
            nft721_0.address,
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
            "Name",
            nft721_0.address,
            askOrderFwithP1.hash,
            erin,
            1,
            200,
            AddressZero,
            AddressZero
        );
        const bidOrderFwithoutP1 = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrderFwithoutP1.hash,
            erin,
            1,
            201,
            AddressZero,
            AddressZero
        );

        await bid1(nft721_0, proxy, askOrderFwithP1.order, bidOrderFwithP1.order);
        await checkEvent(nft721_0, "Claim", [askOrderFwithP1.hash, erin.address, 1, 200, erin.address, AddressZero]);
        await expect(bid1(nft721_0, bob, askOrderFwithoutP1.order, bidOrderFwithoutP1.order)).to.be.revertedWith(
            "SHOYU: FAILURE"
        );

        const bidOrderDwithP1 = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrderDwithP1.hash,
            frank,
            1,
            990,
            AddressZero,
            AddressZero
        );
        const bidOrderDwithoutP1 = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrderDwithoutP1.hash,
            frank,
            1,
            980,
            AddressZero,
            AddressZero
        );

        await bid1(nft721_0, proxy, askOrderDwithP1.order, bidOrderDwithP1.order);
        await checkEvent(nft721_0, "Claim", [askOrderDwithP1.hash, frank.address, 1, 990, frank.address, AddressZero]);
        await expect(bid1(nft721_0, bob, askOrderDwithoutP1.order, bidOrderDwithoutP1.order)).to.be.revertedWith(
            "SHOYU: FAILURE"
        );
    });

    it("should be that bid and claim functions work properly with _bidHashes", async () => {
        const {
            factory,
            nft721,
            royaltyVault,
            erc20Mock,
            englishAuction,
            dutchAuction,
            fixedPriceSale,
        } = await setupTest();

        const { alice, bob, carol, dan, erin, frank, proxy } = getWallets();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndMintBatch(
            alice.address,
            "Name",
            "Symbol",
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
            royaltyVault.address,
            10
        );
        const nft721_0 = await getNFT721(factory);

        await factory.setStrategyWhitelisted(englishAuction.address, true);
        await factory.setStrategyWhitelisted(dutchAuction.address, true);
        await factory.setStrategyWhitelisted(fixedPriceSale.address, true);

        const currentTime = await getBlockTimestamp();
        const deadline = currentTime + 100;

        await erc20Mock.mint(dan.address, 10000000);
        await erc20Mock.mint(erin.address, 10000000);
        await erc20Mock.mint(frank.address, 10000000);
        await erc20Mock.connect(dan).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(erin).approve(nft721_0.address, 10000000);
        await erc20Mock.connect(frank).approve(nft721_0.address, 10000000);

        const askOrderE0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            proxy.address,
            nft721_0.address,
            0,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            currentTime + 30,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );
        const askOrderE1 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            proxy.address,
            nft721_0.address,
            1,
            1,
            englishAuction.address,
            erc20Mock.address,
            AddressZero,
            currentTime + 30,
            defaultAbiCoder.encode(["uint256", "uint256"], [50, currentTime])
        );

        const askOrderF0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            proxy.address,
            nft721_0.address,
            2,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            AddressZero,
            deadline,
            defaultAbiCoder.encode(["uint256", "uint256"], [200, currentTime])
        );

        const askOrderD0 = await signAsk(
            ethers.provider,
            "Name",
            nft721_0.address,
            alice,
            proxy.address,
            nft721_0.address,
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
            "Name",
            nft721_0.address,
            askOrderE0.hash,
            dan,
            1,
            100,
            AddressZero,
            AddressZero
        );
        const bidOrderE1 = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrderE1.hash,
            dan,
            1,
            101,
            AddressZero,
            AddressZero
        );

        expect(await nft721_0.approvedBidHash(proxy.address, askOrderE0.hash, dan.address)).to.be.equal(HashZero);
        await expect(nft721_0.connect(proxy).updateApprovedBidHash(askOrderE0.hash, dan.address, bidOrderE0.hash))
            .to.emit(nft721_0, "UpdateApprovedBidHash")
            .withArgs(proxy.address, askOrderE0.hash, dan.address, bidOrderE0.hash);
        expect(await nft721_0.approvedBidHash(proxy.address, askOrderE0.hash, dan.address)).to.be.equal(
            bidOrderE0.hash
        );

        await expect(
            bid2(
                nft721_0,
                dan,
                askOrderE0.order,
                bidOrderE0.order.amount,
                bidOrderE0.order.price,
                bidOrderE0.order.recipient
            )
        ).to.be.revertedWith("SHOYU: FORBIDDEN");

        await mine(30);
        await expect(nft721_0.connect(carol).claim(askOrderE0.order)).to.be.revertedWith("SHOYU: FAILURE");
        await bid1(nft721_0, frank, askOrderE0.order, bidOrderE0.order); //frank can call
        await checkEvent(nft721_0, "Claim", [askOrderE0.hash, dan.address, 1, 100, dan.address, AddressZero]);
        expect(await nft721_0.approvedBidHash(proxy.address, askOrderE0.hash, dan.address)).to.be.equal(HashZero);

        const bidOrderE1_ = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrderE1.hash,
            dan,
            1,
            70,
            AddressZero,
            AddressZero
        );
        await nft721_0.connect(dan).updateApprovedBidHash(askOrderE1.hash, dan.address, bidOrderE1_.hash); //make fake hash for abusing
        expect(await nft721_0.approvedBidHash(dan.address, askOrderE1.hash, dan.address)).to.be.equal(bidOrderE1_.hash);
        expect(await nft721_0.approvedBidHash(proxy.address, askOrderE1.hash, dan.address)).to.be.equal(HashZero);
        await expect(bid1(nft721_0, dan, askOrderE1.order, bidOrderE1_.order)).to.be.revertedWith("SHOYU: FORBIDDEN");

        expect(await getBlockTimestamp()).to.be.gt(askOrderE1.order.deadline);
        await nft721_0.connect(proxy).updateApprovedBidHash(askOrderE1.hash, dan.address, bidOrderE1.hash); //timeover but update available
        expect(await nft721_0.approvedBidHash(proxy.address, askOrderE1.hash, dan.address)).to.be.equal(
            bidOrderE1.hash
        );

        const bidOrderE1__ = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrderE1.hash,
            dan,
            1,
            70,
            AddressZero,
            AddressZero
        ); //change conditions after hash approved
        await expect(bid1(nft721_0, dan, askOrderE1.order, bidOrderE1__.order)).to.be.revertedWith("SHOYU: FORBIDDEN");

        await bid1(nft721_0, dan, askOrderE1.order, bidOrderE1.order);
        await checkEvent(nft721_0, "Claim", [askOrderE1.hash, dan.address, 1, 101, dan.address, AddressZero]);
        expect(await nft721_0.approvedBidHash(proxy.address, askOrderE1.hash, dan.address)).to.be.equal(HashZero);
        expect(await nft721_0.ownerOf(1)).to.be.equal(dan.address);

        const bidOrderF0 = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrderF0.hash,
            erin,
            1,
            200,
            AddressZero,
            AddressZero
        );

        await mine(100);
        expect(await getBlockTimestamp()).to.be.gt(askOrderF0.order.deadline);
        await nft721_0.connect(proxy).updateApprovedBidHash(askOrderF0.hash, erin.address, bidOrderF0.hash); //timeover but update available
        expect(await nft721_0.approvedBidHash(proxy.address, askOrderF0.hash, erin.address)).to.be.equal(
            bidOrderF0.hash
        );

        await bid1(nft721_0, erin, askOrderF0.order, bidOrderF0.order);
        await checkEvent(nft721_0, "Claim", [askOrderF0.hash, erin.address, 1, 200, erin.address, AddressZero]);
        expect(await nft721_0.approvedBidHash(proxy.address, askOrderF0.hash, erin.address)).to.be.equal(HashZero);
        expect(await nft721_0.ownerOf(2)).to.be.equal(erin.address);

        const bidOrderD0 = await signBid(
            ethers.provider,
            "Name",
            nft721_0.address,
            askOrderD0.hash,
            frank,
            1,
            990,
            AddressZero,
            AddressZero
        );
        expect(await getBlockTimestamp()).to.be.gt(askOrderD0.order.deadline);
        await nft721_0.connect(proxy).updateApprovedBidHash(askOrderD0.hash, frank.address, bidOrderD0.hash); //timeover but update available
        expect(await nft721_0.approvedBidHash(proxy.address, askOrderD0.hash, frank.address)).to.be.equal(
            bidOrderD0.hash
        );

        await bid1(nft721_0, frank, askOrderD0.order, bidOrderD0.order);
        await checkEvent(nft721_0, "Claim", [askOrderD0.hash, frank.address, 1, 990, frank.address, AddressZero]);
        expect(await nft721_0.approvedBidHash(proxy.address, askOrderD0.hash, frank.address)).to.be.equal(HashZero);
        expect(await nft721_0.ownerOf(4)).to.be.equal(frank.address);
    });
});
