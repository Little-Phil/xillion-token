const { expect } = require("chai")

describe("Token", async () => {
  let Token, token
  const NAME = "XIL"
  const SYMBOL = "XIL"
  beforeEach(async () => {
    Token = await ethers.getContractFactory("XILToken")
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

/*
const { expect } = require("chai");

describe("Greeter", function() {
  it("Should return the new greeting once it's changed", async function() {
    const Greeter = await ethers.getContractFactory("Greeter");
    const greeter = await Greeter.deploy("Hello, world!");
    
    await greeter.deployed();
    expect(await greeter.greet()).to.equal("Hello, world!");

    await greeter.setGreeting("Hola, mundo!");
    expect(await greeter.greet()).to.equal("Hola, mundo!");
  });
});
*/
