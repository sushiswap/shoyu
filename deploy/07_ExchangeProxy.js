module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer, admin } = await getNamedAccounts();
    const { deploy, execute } = deployments;

    const result = await deploy("ExchangeProxy", {
        from: deployer,
        args: [],
        log: true,
    });
    if (result.newlyDeployed) {
        await execute("ExchangeProxy", { from: deployer, log: true }, "setClaimerWhitelisted", admin, true);
    }
};
