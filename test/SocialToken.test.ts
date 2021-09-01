import { TokenFactory, SocialTokenV0, ERC20Mock } from "../typechain";

import { sign, convertToHash, domainSeparator, getDigest, getHash, signAsk, signBid } from "./utils/sign-utils";
import { ethers } from "hardhat";
import { BigNumber, BigNumberish, Wallet, Contract } from "ethers";
import { expect, assert } from "chai";
import { solidityPack, toUtf8String, defaultAbiCoder } from "ethers/lib/utils";

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

    const SocialTokenContract = await ethers.getContractFactory("SocialTokenV0");
    const socialToken = (await SocialTokenContract.deploy()) as SocialTokenV0;

    const ERC20MockContract = await ethers.getContractFactory("ERC20Mock");
    const erc20Mock = (await ERC20MockContract.deploy()) as ERC20Mock;

    await factory.setDeployerWhitelisted(AddressZero, true);
    await factory.upgradeSocialToken(socialToken.address);

    return {
        deployer,
        protocolVault,
        operationalVault,
        factory,
        alice,
        bob,
        carol,
        royaltyVault,
        socialToken,
        erc20Mock,
    };
};

async function getSocialToken(factory: TokenFactory): Promise<SocialTokenV0> {
    const events = await factory.queryFilter(factory.filters.DeploySocialToken(), "latest");
    const SocialTokenContract = await ethers.getContractFactory("SocialTokenV0");
    return (await SocialTokenContract.attach(events[0].args[0])) as SocialTokenV0;
}

describe("SocialToken", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    it("should be that default values are set correctly with batch minting deploy", async () => {
        const { factory, alice, erc20Mock } = await setupTest();

        await factory.deploySocialToken(alice.address, "Name", "Symbol", erc20Mock.address, 10000);
        const socialToken = await getSocialToken(factory);

        expect(await socialToken.PERMIT_TYPEHASH()).to.be.equal(
            convertToHash("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")
        );
        expect(await socialToken.DOMAIN_SEPARATOR()).to.be.equal(
            await domainSeparator(ethers.provider, "Name", socialToken.address)
        );
        expect(await socialToken.factory()).to.be.equal(factory.address);
    });

    it("should be that permit fuctions work well", async () => {
        const { factory, alice, bob, carol, erc20Mock } = await setupTest();

        const owner = ethers.Wallet.createRandom();

        await factory.deploySocialToken(owner.address, "Name", "Symbol", erc20Mock.address, 10000);
        const socialToken = await getSocialToken(factory);

        const currentTime = Math.floor(new Date().getTime() / 1000);
        let deadline = currentTime + 100;
        const permitDigest0 = await getDigest(
            ethers.provider,
            "Name",
            socialToken.address,
            getHash(
                ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
                [await socialToken.PERMIT_TYPEHASH(), owner.address, bob.address, 123, 0, deadline]
            )
        );
        const { v: v0, r: r0, s: s0 } = sign(permitDigest0, owner);

        expect(await socialToken.allowance(owner.address, bob.address)).to.be.equal(0);
        await socialToken.permit(owner.address, bob.address, 123, deadline, v0, r0, s0);
        expect(await socialToken.allowance(owner.address, bob.address)).to.be.equal(123);

        const { v: v1, r: r1, s: s1 } = sign(
            await getDigest(
                ethers.provider,
                "Name",
                socialToken.address,
                getHash(
                    ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
                    [await socialToken.PERMIT_TYPEHASH(), owner.address, alice.address, 55, 1, deadline]
                )
            ),
            owner
        );

        const { v: fv0, r: fr0, s: fs0 } = sign(
            await getDigest(
                ethers.provider,
                "Name",
                socialToken.address,
                getHash(
                    ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
                    [await socialToken.PERMIT_TYPEHASH(), owner.address, alice.address, 55, 111, deadline] //invalid nonce
                )
            ),
            owner
        );
        const { v: fv1, r: fr1, s: fs1 } = sign(
            await getDigest(
                ethers.provider,
                "Name",
                socialToken.address,
                getHash(
                    ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
                    [await socialToken.PERMIT_TYPEHASH(), owner.address, alice.address, 55, 3, deadline - 120] //deadline over
                )
            ),
            owner
        );
        const fakeSigner = ethers.Wallet.createRandom();
        const { v: fv2, r: fr2, s: fs2 } = sign(
            await getDigest(
                ethers.provider,
                "Name",
                socialToken.address,
                getHash(
                    ["bytes32", "address", "address", "uint256", "uint256", "uint256"],
                    [await socialToken.PERMIT_TYPEHASH(), owner.address, alice.address, 55, 3, deadline] //fake signer
                )
            ),
            fakeSigner
        );
        await expect(socialToken.permit(owner.address, alice.address, 55, deadline, fv0, fr0, fs0)).to.be.revertedWith(
            "SHOYU: UNAUTHORIZED"
        ); //invalid nonce
        await expect(
            socialToken.permit(owner.address, alice.address, 55, deadline - 120, fv1, fr1, fs1)
        ).to.be.revertedWith("SHOYU: EXPIRED"); //deadline over
        await expect(socialToken.permit(owner.address, carol.address, 55, deadline, v1, r1, s1)).to.be.revertedWith(
            "SHOYU: UNAUTHORIZED"
        ); //wrong spender
        await expect(socialToken.permit(owner.address, alice.address, 55, deadline, fv2, fr2, fs2)).to.be.revertedWith(
            "SHOYU: UNAUTHORIZED"
        ); //fake signer

        await socialToken.permit(owner.address, alice.address, 55, deadline, v1, r1, s1);
        expect(await socialToken.allowance(owner.address, alice.address)).to.be.equal(55);
    });
});
