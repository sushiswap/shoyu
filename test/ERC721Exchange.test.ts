import {
    TokenFactory,
    ERC721Exchange,
    FixedPriceSale,
    EnglishAuction,
    DutchAuction,
    ERC721Mock,
    ERC20Mock,
} from "../typechain";
import { signAsk } from "./utils/sign-utils";

const { ethers } = require("hardhat");

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

    const FixedPriceSaleContract = await ethers.getContractFactory("FixedPriceSale");
    const fixedPriceSale = (await FixedPriceSaleContract.deploy()) as FixedPriceSale;
    await factory.setStrategyWhitelisted(fixedPriceSale.address, true);

    const EnglishAuctionContract = await ethers.getContractFactory("EnglishAuction");
    const englishAuction = (await EnglishAuctionContract.deploy()) as EnglishAuction;
    await factory.setStrategyWhitelisted(englishAuction.address, true);

    const DutchAuctionContract = await ethers.getContractFactory("DutchAuction");
    const dutchAuction = (await DutchAuctionContract.deploy()) as DutchAuction;
    await factory.setStrategyWhitelisted(dutchAuction.address, true);

    const ERC721ExchangeContract = await ethers.getContractFactory("ERC721Exchange");
    const erc721Exchange = ERC721ExchangeContract.attach(await factory.erc721Exchange()) as ERC721Exchange;

    const ERC721MockContract = await ethers.getContractFactory("ERC721Mock");
    const erc721Mock = (await ERC721MockContract.deploy()) as ERC721Mock;

    const ERC20MockContract = await ethers.getContractFactory("ERC20Mock");
    const erc20Mock = (await ERC20MockContract.deploy()) as ERC20Mock;

    return {
        deployer,
        factory,
        erc721Exchange,
        fixedPriceSale,
        englishAuction,
        dutchAuction,
        alice,
        bob,
        carol,
        erc721Mock,
        erc20Mock,
    };
};

describe("ERC721Exchange", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    it("should be able to trade ERC721s using FixedPriceSale", async () => {
        const { erc721Exchange, fixedPriceSale, alice, erc721Mock, erc20Mock } = await setupTest();

        await erc721Mock.safeMint(alice.address, 0, "");

        const signature = await signAsk(
            ethers.provider,
            "ERC721Exchange",
            erc721Exchange.address,
            alice.address,
            erc721Mock.address,
            0,
            1,
            fixedPriceSale.address,
            erc20Mock.address,
            ethers.constants.AddressZero,
            ethers.constants.MaxUint256,
            ""
        );
    });
});
