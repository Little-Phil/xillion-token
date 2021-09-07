const hre = require("hardhat")
const { BigNumber } = require("@ethersproject/bignumber")

async function main() {
  const TOTAL_SUPPLY = BigNumber.from("250000000" + "0".repeat(18))

  const XIL = await hre.ethers.getContractFactory("XIL_BSC")
  const xil = await upgrades.deployProxy(XIL, ["XIL", "XIL", TOTAL_SUPPLY], {
    initializer: "tokenInit",
  })
  await xil.deployed()
  console.log("XILCoin deployed to:", xil.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
