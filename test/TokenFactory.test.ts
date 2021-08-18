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

import { domainSeparator, getMint1155Digest, getMint721Digest, getRSV, sign } from "./utils/sign-utils";
import { hexlify } from "ethers/lib/utils";
import { ethers, getNamedAccounts } from "hardhat";
import { expect } from "chai";
import { ContractReceipt } from "@ethersproject/contracts";

const { BigNumber, utils, constants, Contract } = ethers;
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

    it("should be that NFT721, NFT1155, SocialToken can't be deployed if upgradeXXX functions are not called before", async () => {
        const { factory, alice, bob, carol, erc20Mock, nft721, nft1155, socialToken } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);

        await expect(
            factory
                .connect(alice)
                ["deployNFT721(address,string,string,uint256[],address,uint8)"](
                    alice.address,
                    "N",
                    "S",
                    [0, 2],
                    bob.address,
                    10
                )
        ).to.be.reverted;
        await expect(
            factory
                .connect(bob)
                ["deployNFT721(address,string,string,uint256,address,uint8)"](
                    carol.address,
                    "N",
                    "S",
                    10,
                    alice.address,
                    10
                )
        ).to.be.reverted;
        await expect(factory.connect(carol).deployNFT1155(alice.address, [0, 2], [11, 33], bob.address, 10)).to.be
            .reverted;
        await expect(factory.deploySocialToken(alice.address, "N", "S", erc20Mock.address)).to.be.reverted;

        await factory.upgradeNFT721(nft721.address);
        await factory
            .connect(alice)
            ["deployNFT721(address,string,string,uint256[],address,uint8)"](
                alice.address,
                "N",
                "S",
                [0, 2],
                bob.address,
                10
            );
        await factory
            .connect(bob)
            ["deployNFT721(address,string,string,uint256,address,uint8)"](
                carol.address,
                "N",
                "S",
                10,
                alice.address,
                10
            );
        await expect(factory.connect(carol).deployNFT1155(alice.address, [0, 2], [11, 33], bob.address, 10)).to.be
            .reverted;
        await expect(factory.deploySocialToken(alice.address, "N", "S", erc20Mock.address)).to.be.reverted;

        await factory.upgradeNFT1155(nft1155.address);
        await factory.connect(carol).deployNFT1155(alice.address, [0, 2], [11, 33], bob.address, 10);
        await expect(factory.deploySocialToken(alice.address, "N", "S", erc20Mock.address)).to.be.reverted;

        await factory.upgradeSocialToken(socialToken.address);
        await factory.deploySocialToken(alice.address, "N", "S", erc20Mock.address);
    });

    it("should be that only accounts in DeployerWhitelist can deploy proxies if isDeployerWhitelisted(address(0)) is false", async () => {
        const { factory, alice, bob, nft721 } = await setupTest();

        await factory.upgradeNFT721(nft721.address);
        expect(await factory.isDeployerWhitelisted(AddressZero)).to.be.false;

        expect(await factory.isDeployerWhitelisted(bob.address)).to.be.false;
        await expect(
            factory
                .connect(bob)
                ["deployNFT721(address,string,string,uint256[],address,uint8)"](
                    alice.address,
                    "N",
                    "S",
                    [0, 2],
                    bob.address,
                    10
                )
        ).to.be.revertedWith("SHOYU: FORBIDDEN");

        await factory.setDeployerWhitelisted(alice.address, true);
        expect(await factory.isDeployerWhitelisted(alice.address)).to.be.true;
        await factory
            .connect(alice)
            ["deployNFT721(address,string,string,uint256[],address,uint8)"](
                alice.address,
                "N",
                "S",
                [0, 2],
                bob.address,
                10
            );
    });

    it("should be that accounts not in DeployerWhitelist can deploy proxies if isDeployerWhitelisted(address(0)) is true", async () => {
        const { factory, alice, bob, carol, nft721, nft1155 } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        expect(await factory.isDeployerWhitelisted(AddressZero)).to.be.true;

        expect(await factory.isDeployerWhitelisted(alice.address)).to.be.false;
        expect(await factory.isDeployerWhitelisted(bob.address)).to.be.false;

        await factory.upgradeNFT721(nft721.address);
        await factory
            .connect(alice)
            ["deployNFT721(address,string,string,uint256[],address,uint8)"](
                alice.address,
                "N",
                "S",
                [0, 2],
                bob.address,
                10
            );
        await factory
            .connect(bob)
            ["deployNFT721(address,string,string,uint256,address,uint8)"](
                carol.address,
                "N",
                "S",
                10,
                alice.address,
                10
            );

        await factory.upgradeNFT1155(nft1155.address);
        await factory.connect(alice).deployNFT1155(alice.address, [0, 2], [11, 33], bob.address, 10);
        await factory.connect(bob).deployNFT1155(bob.address, [11, 25], [1, 2], carol.address, 5);
    });

    it.only("should be that someone who has NFT721/1155 contract owner's signature can call mint721/1155, mintWithTags721/1155 functions", async () => {
        const {
            factory,
            deployer,
            alice,
            bob,
            carol,
            erc721Mock,
            erc1155Mock,
            erc20Mock,
            nft721,
            nft1155,
            socialToken,
        } = await setupTest();

        function getAddressNFT721(res: ContractReceipt, n: number): string {
            if (res.events !== undefined) {
                const args = res.events[n].args;
                if (args !== undefined) {
                    return args[0];
                }
            }
            return "";
        }

        async function getAddressNFT1155(): Promise<string> {
            const events = await factory.queryFilter(factory.filters.DeployNFT1155(), "latest");
            return events[0].args[0];
        }

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);
        let tx = await factory
            .connect(alice)
            ["deployNFT721(address,string,string,uint256[],address,uint8)"](
                carol.address,
                "N",
                "S",
                [0, 2],
                bob.address,
                10
            );
        let res = await tx.wait();
        const nft721_0 = getAddressNFT721(res, 5);
        tx = await factory
            .connect(bob)
            ["deployNFT721(address,string,string,uint256,address,uint8)"](
                carol.address,
                "N",
                "S",
                10,
                alice.address,
                10
            );
        res = await tx.wait();
        const nft721_1 = getAddressNFT721(res, 4);

        await factory.upgradeNFT1155(nft1155.address);
        await factory.connect(alice).deployNFT1155(carol.address, [0, 2], [11, 33], bob.address, 10);
        const nft1155_0 = await getAddressNFT1155();
        await factory.connect(bob).deployNFT1155(carol.address, [11, 25], [1, 2], carol.address, 5);
        const nft1155_1 = await getAddressNFT1155();
        
        const digest721_0 = await getMint721Digest(ethers.provider, nft721_0, alice.address, 1, [], factory.address, 0);
        const { v: v0, r: r0, s: s0 } = getRSV(await deployer.signMessage(digest721_0));

        // await expect(factory.connect(bob).mint721(nft721_0, bob.address, 1, [], v0, r0, s0)).to.be.revertedWith(
        //     "SHOYU: UNAUTHORIZED"
        // );
        // await expect(factory.connect(alice).mint721(nft721_0, alice.address, 2, [], v0, r0, s0)).to.be.revertedWith(
        //     "SHOYU: UNAUTHORIZED"
        // );
        // await factory.connect(alice).mint721(nft721_0, alice.address, 1, [], v0, r0, s0);
        // expect(await )
    });

    it("should be b", async () => {
        const {
            factory,
            alice,
            bob,
            carol,
            erc721Mock,
            erc1155Mock,
            erc20Mock,
            nft721,
            nft1155,
            socialToken,
        } = await setupTest();

        await factory.setDeployerWhitelisted(AddressZero, true);
        await factory.upgradeNFT721(nft721.address);
        await factory
            .connect(alice)
            ["deployNFT721(address,string,string,uint256[],address,uint8)"](
                carol.address,
                "N",
                "S",
                [0, 2],
                bob.address,
                10
            );
        await factory
            .connect(bob)
            ["deployNFT721(address,string,string,uint256,address,uint8)"](
                carol.address,
                "N",
                "S",
                10,
                alice.address,
                10
            );

        await factory.upgradeNFT1155(nft1155.address);
        await factory.connect(alice).deployNFT1155(carol.address, [0, 2], [11, 33], bob.address, 10);
        await factory.connect(bob).deployNFT1155(carol.address, [11, 25], [1, 2], carol.address, 5);
    });

    it("should be -", async () => {
        const {
            factory,
            alice,
            bob,
            carol,
            erc721Mock,
            erc1155Mock,
            erc20Mock,
            nft721,
            nft1155,
            socialToken,
        } = await setupTest();
    });
});
