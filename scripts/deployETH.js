const hre = require("hardhat")

async function main() {
  const XIL = await hre.ethers.getContractFactory("XIL_ETH")
  const xil = await XIL.deploy()

  await xil.deployed()

  console.log("XILCoin deployed to:", xil.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
