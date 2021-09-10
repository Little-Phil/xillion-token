require("@nomiclabs/hardhat-waffle")
require("@openzeppelin/hardhat-upgrades")
require("dotenv").config()

task("accounts", "Prints the list of accounts", async () => {
  const accounts = await ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.4",
  networks: {
    local: {
      url: "http://127.0.0.1:8545/",
    },
    rinkeby: {
      url: process.env.RINKEBY_ALCHEMY_KEY,
      accounts: { mnemonic: process.env.MY_MNEMONIC },
    },
    ropsten: {
      url: process.env.ROPSTEN_INFURA_KEY,
      accounts: { mnemonic: process.env.MY_MNEMONIC },
    },
    testBSC: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545/",
      accounts: { mnemonic: process.env.MY_MNEMONIC },
    },
  },
}
