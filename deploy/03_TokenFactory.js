const xSUSHI = "0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272";

module.exports = async ({ getNamedAccounts, deployments, getChainId }) => {
    const { deployer, admin } = await getNamedAccounts();
    const { deploy, execute, get } = deployments;

    const chainId = await getChainId();
    const recipient = chainId === "1" ? xSUSHI : admin;
    const baseURI = "https://api.shoyunft.com/metadata/" + chainId + "/";
    const result = await deploy("TokenFactory", {
        from: deployer,
        args: [recipient, 25, admin, 0, baseURI, baseURI],
        log: true,
    });

    if (result.newlyDeployed) {
        await execute("TokenFactory", { from: deployer, log: true }, "setDeployerWhitelisted", admin, true);
        const nft721 = await get("NFT721V0");
        await execute("TokenFactory", { from: deployer, log: true }, "upgradeNFT721", nft721.address);
        const nft1155 = await get("NFT1155V0");
        await execute("TokenFactory", { from: deployer, log: true }, "upgradeNFT1155", nft1155.address);
        const socialToken = await get("SocialTokenV0");
        await execute("TokenFactory", { from: deployer, log: true }, "upgradeSocialToken", socialToken.address);
    }
};
