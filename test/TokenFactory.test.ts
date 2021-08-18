import {
    TokenFactory,
    ERC721ExchangeV0,
    ERC1155ExchangeV0,
    NFT721V0,
    NFT1155V0,
    SocialTokenV0,
    ERC721Mock,
    ERC1155Mock,
    ERC20Mock,
} from "../typechain";

import { ecsign } from "ethereumjs-util";
import { hexlify } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { expect } from "chai";

const { BigNumber, utils, constants } = ethers;
const { AddressZero } = constants;

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

    const ERC721ExchangeContract = await ethers.getContractFactory("ERC721ExchangeV0");
    const erc721Exchange = (await ERC721ExchangeContract.deploy(factory.address)) as ERC721ExchangeV0;

    const ERC1155ExchangeContract = await ethers.getContractFactory("ERC1155ExchangeV0");
    const erc1155Exchange = (await ERC1155ExchangeContract.deploy(factory.address)) as ERC1155ExchangeV0;

    const NFT721Contract = await ethers.getContractFactory("NFT721V0");
    const nft721 = (await NFT721Contract.deploy()) as NFT721V0;

    const NFT1155Contract = await ethers.getContractFactory("NFT1155V0");
    const nft1155 = (await NFT1155Contract.deploy()) as NFT1155V0;

    const SocialTokenContract = await ethers.getContractFactory("SocialTokenV0");
    const socialToken = (await SocialTokenContract.deploy()) as SocialTokenV0;

    const ERC721MockContract = await ethers.getContractFactory("ERC721Mock");
    const erc721Mock = (await ERC721MockContract.deploy()) as ERC721Mock;

    const ERC1155MockContract = await ethers.getContractFactory("ERC1155Mock");
    const erc1155Mock = (await ERC1155MockContract.deploy()) as ERC1155Mock;

    const ERC20MockContract = await ethers.getContractFactory("ERC20Mock");
    const erc20Mock = (await ERC20MockContract.deploy()) as ERC20Mock;

    return {
        deployer,
        protocolVault,
        operationalVault,
        factory,
        erc721Exchange,
        erc1155Exchange,
        nft721,
        nft1155,
        socialToken,
        alice,
        bob,
        carol,
        erc721Mock,
        erc1155Mock,
        erc20Mock,
    };
};

describe("TokenFactory", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    it("should be FeeInfo functions return proper value", async () => {
        const { protocolVault, operationalVault, factory } = await setupTest();

        expect((await factory.protocolFeeInfo())[0]).to.be.equal(protocolVault.address);
        expect((await factory.protocolFeeInfo())[1]).to.be.equal(25);
        expect((await factory.operationalFeeInfo())[0]).to.be.equal(operationalVault.address);
        expect((await factory.operationalFeeInfo())[1]).to.be.equal(5);
    });

    it("should be fail if non-owner calls onlyOwner functions", async () => {
        const { factory, alice } = await setupTest();

        await expect(factory.connect(alice).setBaseURI721("https://shoyu.sushi.com/nft721/")).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
        await expect(factory.connect(alice).setBaseURI1155("https://shoyu.sushi.com/nft1155/")).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
        await expect(factory.connect(alice).setProtocolFeeRecipient(alice.address)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
        await expect(factory.connect(alice).setOperationalFeeRecipient(alice.address)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
        await expect(factory.connect(alice).setOperationalFee(10)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
        await expect(factory.connect(alice).setDeployerWhitelisted(alice.address, true)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
        await expect(factory.connect(alice).setStrategyWhitelisted(alice.address, true)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
        await expect(factory.connect(alice).upgradeNFT721(alice.address)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
        await expect(factory.connect(alice).upgradeNFT1155(alice.address)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
        await expect(factory.connect(alice).upgradeSocialToken(alice.address)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
        await expect(factory.connect(alice).upgradeERC721Exchange(alice.address)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
        await expect(factory.connect(alice).upgradeERC1155Exchange(alice.address)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
    });

    it.only("should be that NFT721, NFT1155, SocialToken can't be deployed if upgradeXXX functions are not called before", async () => {
        const { factory, alice, bob, carol, erc721Mock, erc1155Mock, erc20Mock, nft721, nft1155, socialToken } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);

        await expect(factory.connect(alice)["deployNFT721(address,string,string,uint256[],address,uint8)"](alice.address, "N", "S", [0,2], bob.address, 10)).to.be.reverted;
        await expect(factory.connect(bob)["deployNFT721(address,string,string,uint256,address,uint8)"](carol.address, "N", "S", 10, alice.address, 10)).to.be.reverted;
        await expect(factory.connect(carol).deployNFT1155(alice.address, [0,2], [11,33], bob.address, 10)).to.be.reverted;
        await expect(factory.deploySocialToken(alice.address, "N", "S", erc20Mock.address)).to.be.reverted;

        await factory.upgradeNFT721(nft721.address);
        await factory.connect(alice)["deployNFT721(address,string,string,uint256[],address,uint8)"](alice.address, "N", "S", [0,2], bob.address, 10);
        // await factory.connect(bob)["deployNFT721(address,string,string,uint256,address,uint8)"](carol.address, "N", "S", 10, alice.address, 10);
        // await expect(factory.connect(carol).deployNFT1155(alice.address, [0,2], [11,33], bob.address, 10)).to.be.reverted;
        // await expect(factory.deploySocialToken(alice.address, "N", "S", erc20Mock.address)).to.be.reverted;

        // await factory.upgradeNFT1155(nft1155.address);
        // await factory.connect(carol).deployNFT1155(alice.address, [0,2], [11,33], bob.address, 10);
        // await expect(factory.deploySocialToken(alice.address, "N", "S", erc20Mock.address)).to.be.reverted;

        // await factory.upgradeNFT1155(nft1155.address);
        // await factory.deploySocialToken(alice.address, "N", "S", erc20Mock.address);
    });

    it("should be that any account can deploy proxies if isDeployerWhitelisted(address(0)) is true", async () => {
        const { factory, alice, bob, carol, erc721Mock, erc1155Mock, erc20Mock } = await setupTest();

        // await expect(factory.connect(alice).deployNFT721(alice.address, "N", "S", [0,2,4], bob.address, 10)).to.be.revertedWith(
        //     "Ownable: caller is not the owner"
        // );

    });

    it("should be that any account in DeployerWhitelist can deploy proxies although isDeployerWhitelisted(address(0)) is false", async () => {
        const { factory } = await setupTest();
    });

    it("should be -", async () => {
        const { protocolVault, operationalVault, factory } = await setupTest();
    });

    it("should be -", async () => {
        const { protocolVault, operationalVault, factory } = await setupTest();
    });

    it("should be -", async () => {
        const { protocolVault, operationalVault, factory } = await setupTest();
    });
});
