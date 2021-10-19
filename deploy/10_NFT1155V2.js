module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();
    const { deploy, execute } = deployments;

    const result = await deploy("NFT1155V2", {
        from: deployer,
        args: [],
        log: true,
    });
    if (result.newlyDeployed) {
        await execute("TokenFactory", { from: deployer, log: true }, "upgradeNFT1155", result.address);
    }
};
