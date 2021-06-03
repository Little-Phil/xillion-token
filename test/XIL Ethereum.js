const { expect } = require("chai")

describe("Token", async () => {
  let Token, token
  const NAME = "XIL"
  const SYMBOL = "XIL"
  beforeEach(async () => {
    Token = await ethers.getContractFactory("XIL_ETH")
    token = await Token.deploy()
  })
  describe("Checking correct deployment", () => {
    it("has a name", async () => {
      expect(await token.name()).to.equal(NAME)
    })

    it("has a symbol", async () => {
      expect(await token.symbol()).to.equal(SYMBOL)
    })
  })
})
