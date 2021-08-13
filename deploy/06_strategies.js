module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;

    await deploy("FixedPriceSale", { from: deployer, log: true });
    await deploy("EnglishAuction", { from: deployer, log: true });
    await deploy("DutchAuction", { from: deployer, log: true });
    await deploy("DesignatedSale", { from: deployer, log: true });
};
