const { getNamedAccounts, deployments } = require("hardhat");
const readlineSync = require("readline-sync");

async function main() {
    const address = readlineSync.question("Deployer address: ");
    const set = readlineSync.question("To whitelist (true/false): ");
    const { deployer } = await getNamedAccounts();
    const { execute } = deployments;
    await execute("TokenFactory", { from: deployer }, "setDeployerWhitelisted", address, set === "true");
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
