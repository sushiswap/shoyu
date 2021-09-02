import { TokenFactory, SocialTokenV0, ERC20Mock } from "../typechain";

import { sign, convertToHash, domainSeparator, getDigest, getHash } from "./utils/sign-utils";
import { ethers } from "hardhat";
import { BigNumberish, Wallet } from "ethers";
import { expect } from "chai";
import { mine, autoMining } from "./utils/blocks";

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

        const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
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

    it("should be that SocialToken holders receive their shares properly when the contract receives ERC20 Tokens", async () => {
        const { factory, alice, bob, carol, erc20Mock } = await setupTest();

        async function checkSocialTokenBalances(balances: BigNumberish[]) {
            expect(await socialToken.balanceOf(alice.address)).to.be.equal(balances[0]);
            expect(await socialToken.balanceOf(bob.address)).to.be.equal(balances[1]);
            expect(await socialToken.balanceOf(carol.address)).to.be.equal(balances[2]);
        }
        async function checkDividendOfETH(balances: BigNumberish[]) {
            expect(await erc20Mock.balanceOf(alice.address)).to.be.equal(balances[0]);
            expect(await erc20Mock.balanceOf(bob.address)).to.be.equal(balances[1]);
            expect(await erc20Mock.balanceOf(carol.address)).to.be.equal(balances[2]);
        }

        await factory.deploySocialToken(alice.address, "Name", "Symbol", erc20Mock.address, 10000);
        const socialToken = await getSocialToken(factory);

        //0
        await autoMining(false);
        await socialToken.connect(alice).transfer(bob.address, 1000);
        await mine();

        await autoMining(true);
        await checkSocialTokenBalances([9000, 1000, 0]);
        await checkDividendOfETH([0, 0, 0]);

        //1
        await autoMining(false);
        await erc20Mock.mint(socialToken.address, 10000);
        await socialToken.sync();
        await mine();

        await autoMining(true);
        await checkSocialTokenBalances([9000, 1000, 0]);
        await checkDividendOfETH([0, 0, 0]);

        //2
        await autoMining(false);
        await socialToken.connect(alice).transfer(carol.address, 4000);
        await mine();

        await autoMining(true);
        await checkSocialTokenBalances([5000, 1000, 4000]);
        await checkDividendOfETH([0, 0, 0]);

        //3
        await autoMining(false);
        await socialToken.connect(alice).withdrawDividend();
        await mine();

        await autoMining(true);
        await checkSocialTokenBalances([5000, 1000, 4000]);
        await checkDividendOfETH([9000, 0, 0]);

        //4
        await autoMining(false);
        await erc20Mock.mint(socialToken.address, 30000);
        await socialToken.sync();
        await socialToken.connect(bob).withdrawDividend();
        await mine();

        await autoMining(true);
        await checkSocialTokenBalances([5000, 1000, 4000]);
        await checkDividendOfETH([9000, 4000, 0]);

        //5
        await autoMining(false);
        await erc20Mock.mint(socialToken.address, 20000);
        await socialToken.sync();
        await mine();

        await autoMining(true);
        await checkSocialTokenBalances([5000, 1000, 4000]);
        await checkDividendOfETH([9000, 4000, 0]);

        //6
        await autoMining(false);
        await erc20Mock.mint(socialToken.address, 100000);
        await socialToken.sync();
        await socialToken.connect(bob).transfer(carol.address, 1000);
        await mine();

        await autoMining(true);
        await checkSocialTokenBalances([5000, 0, 5000]);
        await checkDividendOfETH([9000, 4000, 0]);

        //7
        await autoMining(false);
        await socialToken.connect(carol).transfer(bob.address, 4000);
        await socialToken.connect(carol).withdrawDividend();
        await mine();

        await autoMining(true);
        await checkSocialTokenBalances([5000, 4000, 1000]);
        await checkDividendOfETH([9000, 4000, 60000]);

        //8
        await autoMining(false);
        await socialToken.connect(alice).withdrawDividend();
        await erc20Mock.mint(socialToken.address, 70000);
        await socialToken.sync();
        await mine();

        await autoMining(true);
        await checkSocialTokenBalances([5000, 4000, 1000]);
        await checkDividendOfETH([84000, 4000, 60000]);

        //9
        await autoMining(false);
        await socialToken.connect(carol).transfer(bob.address, 1000);
        await erc20Mock.mint(socialToken.address, 40000);
        await socialToken.sync();
        await mine();

        await autoMining(true);
        await checkSocialTokenBalances([5000, 5000, 0]);
        await checkDividendOfETH([84000, 4000, 60000]);

        //10
        await autoMining(false);
        await socialToken.connect(alice).withdrawDividend();
        await socialToken.connect(alice).transfer(bob.address, 2000);
        await mine();

        await autoMining(true);
        await checkSocialTokenBalances([3000, 7000, 0]);
        await checkDividendOfETH([139000, 4000, 60000]);

        //11
        await autoMining(false);
        await socialToken.connect(bob).withdrawDividend();
        await socialToken.connect(alice).transfer(carol.address, 2000);
        await mine();

        await autoMining(true);
        await checkSocialTokenBalances([1000, 7000, 2000]);
        await checkDividendOfETH([139000, 64000, 60000]);

        const dan = Wallet.createRandom();
        const erin = Wallet.createRandom();

        //12
        await autoMining(false);
        await erc20Mock.mint(socialToken.address, 10000);
        await socialToken.sync();
        await socialToken.connect(alice).mint(dan.address, 5000);
        await mine();

        await autoMining(true);
        await checkSocialTokenBalances([1000, 7000, 2000]);
        await checkDividendOfETH([139000, 64000, 60000]);

        expect(await socialToken.balanceOf(dan.address)).to.be.equal(5000);
        expect(await erc20Mock.balanceOf(dan.address)).to.be.equal(0);
        expect(await socialToken.withdrawableDividendOf(dan.address)).to.be.equal(0);

        expect(await socialToken.balanceOf(erin.address)).to.be.equal(0);
        expect(await erc20Mock.balanceOf(erin.address)).to.be.equal(0);
        expect(await socialToken.withdrawableDividendOf(erin.address)).to.be.equal(0);

        //13
        await autoMining(false);
        await erc20Mock.mint(socialToken.address, 10000);
        await socialToken.sync();
        await socialToken.connect(alice).mint(erin.address, 5000);
        await mine();

        await autoMining(true);
        await checkSocialTokenBalances([1000, 7000, 2000]);
        await checkDividendOfETH([139000, 64000, 60000]);

        expect(await socialToken.balanceOf(dan.address)).to.be.equal(5000);
        expect(await erc20Mock.balanceOf(dan.address)).to.be.equal(0);
        expect(await socialToken.withdrawableDividendOf(dan.address)).to.be.equal(3333);

        expect(await socialToken.balanceOf(erin.address)).to.be.equal(5000);
        expect(await erc20Mock.balanceOf(erin.address)).to.be.equal(0);
        expect(await socialToken.withdrawableDividendOf(erin.address)).to.be.equal(0);

        //extra test
        await expect(socialToken.sync()).to.be.revertedWith("SHOYU: INSUFFICIENT_AMOUNT");
        await expect(
            alice.sendTransaction({
                to: socialToken.address,
                value: 1,
            })
        ).to.be.revertedWith("SHOYU: UNABLE_TO_RECEIVE_ETH");
    });

    it("should be that SocialToken holders receive their shares properly when the contract receives ETH", async () => {
        const { factory, deployer, alice, bob, carol } = await setupTest();

        async function checkSocialTokenBalances(balances: BigNumberish[]) {
            expect(await socialToken.balanceOf(alice.address)).to.be.equal(balances[0]);
            expect(await socialToken.balanceOf(bob.address)).to.be.equal(balances[1]);
            expect(await socialToken.balanceOf(carol.address)).to.be.equal(balances[2]);
        }

        await factory.deploySocialToken(alice.address, "Name", "Symbol", AddressZero, 10000);
        const socialToken = await getSocialToken(factory);

        //0
        await expect(() => socialToken.connect(alice).transfer(bob.address, 1000)).to.changeEtherBalances(
            [alice, bob, carol],
            [0, 0, 0]
        );

        await checkSocialTokenBalances([9000, 1000, 0]);

        //1
        await deployer.sendTransaction({ to: socialToken.address, value: 10000 });

        await checkSocialTokenBalances([9000, 1000, 0]);

        //2
        await expect(() => socialToken.connect(alice).transfer(carol.address, 4000)).to.changeEtherBalances(
            [alice, bob, carol],
            [0, 0, 0]
        );

        await checkSocialTokenBalances([5000, 1000, 4000]);

        //3
        await expect(() => socialToken.connect(alice).withdrawDividend()).to.changeEtherBalances(
            [alice, bob, carol],
            [9000, 0, 0]
        );

        await checkSocialTokenBalances([5000, 1000, 4000]);

        //4
        await deployer.sendTransaction({ to: socialToken.address, value: 30000 });
        await expect(() => socialToken.connect(bob).withdrawDividend()).to.changeEtherBalances(
            [alice, bob, carol],
            [0, 4000, 0]
        );

        await checkSocialTokenBalances([5000, 1000, 4000]);

        //5
        await deployer.sendTransaction({ to: socialToken.address, value: 20000 });

        await checkSocialTokenBalances([5000, 1000, 4000]);

        //6
        await deployer.sendTransaction({ to: socialToken.address, value: 100000 });
        await expect(() => socialToken.connect(bob).transfer(carol.address, 1000)).to.changeEtherBalances(
            [alice, bob, carol],
            [0, 0, 0]
        );

        await checkSocialTokenBalances([5000, 0, 5000]);

        //7
        await socialToken.connect(carol).transfer(bob.address, 4000);
        await expect(() => socialToken.connect(carol).withdrawDividend()).to.changeEtherBalances(
            [alice, bob, carol],
            [0, 0, 60000]
        );

        await checkSocialTokenBalances([5000, 4000, 1000]);

        //8
        await expect(() => socialToken.connect(alice).withdrawDividend()).to.changeEtherBalances(
            [alice, bob, carol],
            [75000, 0, 0]
        );
        await deployer.sendTransaction({ to: socialToken.address, value: 70000 });

        await checkSocialTokenBalances([5000, 4000, 1000]);

        //9
        await socialToken.connect(carol).transfer(bob.address, 1000);
        await deployer.sendTransaction({ to: socialToken.address, value: 40000 });

        await checkSocialTokenBalances([5000, 5000, 0]);

        //10
        await expect(() => socialToken.connect(alice).withdrawDividend()).to.changeEtherBalances(
            [alice, bob, carol],
            [55000, 0, 0]
        );
        await socialToken.connect(alice).transfer(bob.address, 2000);

        await checkSocialTokenBalances([3000, 7000, 0]);

        //11
        await expect(() => socialToken.connect(bob).withdrawDividend()).to.changeEtherBalances(
            [alice, bob, carol],
            [0, 60000, 0]
        );
        await socialToken.connect(alice).transfer(carol.address, 2000);

        await checkSocialTokenBalances([1000, 7000, 2000]);

        const dan = Wallet.createRandom();
        const erin = Wallet.createRandom();

        //12
        await deployer.sendTransaction({ to: socialToken.address, value: 10000 });
        await expect(() => socialToken.connect(alice).mint(dan.address, 5000)).to.changeEtherBalances(
            [alice, bob, carol],
            [0, 0, 0]
        );

        await checkSocialTokenBalances([1000, 7000, 2000]);

        expect(await socialToken.balanceOf(dan.address)).to.be.equal(5000);
        expect(await socialToken.withdrawableDividendOf(dan.address)).to.be.equal(0);

        expect(await socialToken.balanceOf(erin.address)).to.be.equal(0);
        expect(await socialToken.withdrawableDividendOf(erin.address)).to.be.equal(0);

        //13
        await deployer.sendTransaction({ to: socialToken.address, value: 10000 });
        await socialToken.connect(alice).mint(erin.address, 5000);

        await checkSocialTokenBalances([1000, 7000, 2000]);

        expect(await socialToken.balanceOf(dan.address)).to.be.equal(5000);
        expect(await socialToken.withdrawableDividendOf(dan.address)).to.be.equal(3333);

        expect(await socialToken.balanceOf(erin.address)).to.be.equal(5000);
        expect(await socialToken.withdrawableDividendOf(erin.address)).to.be.equal(0);
    });
});
