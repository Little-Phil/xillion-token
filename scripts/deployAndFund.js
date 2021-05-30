const hre = require("hardhat")

async function main() {
  const XIL = await hre.ethers.getContractFactory("XIL_BSC")
  const xil = await XIL.deploy()

  await xil.deployed()

  console.log("Greeter deployed to:", xil.address)

  let res = await xil.transfer(
    "0x42261b574358b4EE8ad3D43FB416B4D82D61CD93",
    ethers.BigNumber.from("4200000000000000000")
  )
  console.log(res)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
