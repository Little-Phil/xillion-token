const hre = require("hardhat")

/** THIS CODE IS ONLY FOR LOCAL TESTING. DO NOT USE IN A PRODUCTION ENVIRONMENT
 *  DO NOT USE IN PRODUCTION
 */

async function main() {
  const XIL = await hre.ethers.getContractFactory("XIL_BSC")
  const xil = await XIL.deploy()

  await xil.deployed()

  console.log("Greeter deployed to:", xil.address)

  let res = await xil.transfer(
    "0x42261b574358b4EE8ad3D43FB416B4D82D61CD93",
    ethers.BigNumber.from("4200000000000000000")
  )
  const [signer] = await ethers.getSigners()
  await signer.sendTransaction({
    to: "0x42261b574358b4EE8ad3D43FB416B4D82D61CD93",
    value: ethers.utils.parseEther("10.0"),
  })
  await signer.sendTransaction({
    to: "0x0A70beF8c6993E61391FCdd1fE3a6fD7bcfCa008",
    value: ethers.utils.parseEther("20"),
  })
  console.log("done")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
