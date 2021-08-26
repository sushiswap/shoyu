module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();
    const { get, deploy, execute } = deployments;

    const factory = await get("TokenFactory");
    const exchange = await deploy("ERC721ExchangeV0", {
        from: deployer,
        args: [factory.address],
        log: true,
    });
    if (exchange.newlyDeployed) {
        await execute("TokenFactory", { from: deployer, log: true }, "upgradeERC721Exchange", exchange.address);
    }
};
