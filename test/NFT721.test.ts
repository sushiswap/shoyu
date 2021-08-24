import { TokenFactory, NFT721V0, ERC721Mock } from "../typechain";

import { sign, convertToHash, domainSeparator, getDigest, getHash } from "./utils/sign-utils";
import { ethers } from "hardhat";
import { expect, assert } from "chai";
import { solidityPack, toUtf8String } from "ethers/lib/utils";

const { constants } = ethers;
const { AddressZero } = constants;

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

    const NFT721Contract = await ethers.getContractFactory("NFT721V0");
    const nft721 = (await NFT721Contract.deploy()) as NFT721V0;

    const ERC721MockContract = await ethers.getContractFactory("ERC721Mock");
    const erc721Mock = (await ERC721MockContract.deploy()) as ERC721Mock;

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
    };
};

async function getNFT721(factory: TokenFactory): Promise<NFT721V0> {
    let events: any = await factory.queryFilter(factory.filters.DeployNFT721AndMintBatch(), "latest");
    if (events.length == 0) events = await factory.queryFilter(factory.filters.DeployNFT721AndPark(), "latest");
    const NFT721Contract = await ethers.getContractFactory("NFT721V0");
    return (await NFT721Contract.attach(events[0].args[0])) as NFT721V0;
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

        async function URI721(nft: NFT721V0, tokenId: number): Promise<string> {
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

        expect((await nft721_0.royaltyFeeInfo())[0]).to.be.equal(royaltyVault.address);
        expect((await nft721_0.royaltyInfo(0, 0))[0]).to.be.equal(royaltyVault.address);

        expect((await nft721_0.royaltyFeeInfo())[1]).to.be.equal(13);
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

        async function URI721(nft: NFT721V0, tokenId: number): Promise<string> {
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

        expect((await nft721_0.royaltyFeeInfo())[0]).to.be.equal(royaltyVault.address);
        expect((await nft721_0.royaltyInfo(0, 0))[0]).to.be.equal(royaltyVault.address);

        expect((await nft721_0.royaltyFeeInfo())[1]).to.be.equal(13);
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

        const currentTime = Math.floor(+new Date() / 1000);
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
        expect((await nft721_0.royaltyFeeInfo())[1]).to.be.equal(3);
        await nft721_0.connect(alice).setRoyaltyFee(0);
        expect((await nft721_0.royaltyFeeInfo())[1]).to.be.equal(0);
        await expect(nft721_0.connect(alice).setRoyaltyFee(1)).to.be.revertedWith("SHOYU: INVALID_FEE");

        await factory.deployNFT721AndMintBatch(bob.address, "Name", "Symbol", [9, 11], royaltyVault.address, 0);
        const nft721_1 = await getNFT721(factory);
        expect((await nft721_1.royaltyFeeInfo())[1]).to.be.equal(255);
        await expect(nft721_1.connect(bob).setRoyaltyFee(251)).to.be.revertedWith("SHOYU: INVALID_FEE");
        await nft721_1.connect(bob).setRoyaltyFee(93);
        expect((await nft721_1.royaltyFeeInfo())[1]).to.be.equal(93);
        await expect(nft721_1.connect(bob).setRoyaltyFee(111)).to.be.revertedWith("SHOYU: INVALID_FEE");
        await nft721_1.connect(bob).setRoyaltyFee(0);
        expect((await nft721_1.royaltyFeeInfo())[1]).to.be.equal(0);
        await expect(nft721_1.connect(bob).setRoyaltyFee(1)).to.be.revertedWith("SHOYU: INVALID_FEE");
    });

    it("should be that URI functions work well", async () => {
        const { factory, nft721, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        async function URI721(nft: NFT721V0, tokenId: number, _baseURI?: string): Promise<string> {
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

        await expect(nft721_0.connect(bob).setTokenURI(0, "https://foo.bar/0.json")).to.be.revertedWith("SHOYU: FORBIDDEN");
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
    });

    it("should be that parkTokenIds func work well", async () => {
        const { factory, nft721, alice, bob, royaltyVault } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);

        await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 7, royaltyVault.address, 50);
        const nft721_0 = await getNFT721(factory);

        await expect(nft721_0.connect(bob).parkTokenIds(100)).to.be.revertedWith("SHOYU: FORBIDDEN");
        await expect(nft721_0.connect(alice).parkTokenIds(30)).to.be.revertedWith("SHOYU: INVALID_TO_TOKEN_ID");
        await expect(nft721_0.connect(alice).parkTokenIds(50)).to.be.revertedWith("SHOYU: INVALID_TO_TOKEN_ID");
        await nft721_0.connect(alice).parkTokenIds(51);
        await nft721_0.connect(alice).parkTokenIds(100);
    });

    it.only("should be that mint/mintBatch function well correctly with parking deploy", async () => {
        const signers = await ethers.getSigners();
        const [deployer, alice, bob, carol, royaltyVault] = signers;
    
        const NFT721Contract = await ethers.getContractFactory("NFT721V0");
        const nft721 = (await NFT721Contract.deploy()) as NFT721V0;
    
        const ERC721MockContract = await ethers.getContractFactory("ERC721Mock");
        const erc721Mock = (await ERC721MockContract.deploy()) as ERC721Mock;
    });

    // it.only("should be that mint/mintBatch function well correctly with parking deploy", async () => {
    //     const { factory, nft721, alice, royaltyVault } = await setupTest();

    //     await factory.setDeployerWhitelisted(AddressZero, true);
    //     await factory.upgradeNFT721(nft721.address);

    //     await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 7, royaltyVault.address, 13);
    //     const nft721_0 = await getNFT721(factory);

    // });
    ////////////////////////////
    // it("should be that default values are set correctly with parking deploy", async () => {
    //     const { factory, nft721, alice, royaltyVault } = await setupTest();

    //     await factory.setDeployerWhitelisted(AddressZero, true);
    //     await factory.upgradeNFT721(nft721.address);

    //     await factory.deployNFT721AndPark(alice.address, "Name", "Symbol", 7, royaltyVault.address, 13);
    //     const nft721_0 = await getNFT721(factory);
    // });
});
