const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts();
    const { deploy, execute } = deployments;

    const result = await deploy("SocialTokenV0", {
        from: deployer,
        args: [],
        log: true,
    });
    if (result.newlyDeployed) {
        await execute(
            "SocialTokenV0",
            { from: deployer, log: true },
            "initialize",
            ethers.constants.AddressZero,
            "",
            "",
            ethers.constants.AddressZero,
            0
        );
    }
};
