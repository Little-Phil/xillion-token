const { expect } = require("chai")
const { BigNumber } = require("@ethersproject/bignumber")
const { AddressZero } = require("@ethersproject/constants")

async function increaseTime(n) {
  await hre.network.provider.request({
    method: "evm_increaseTime",
    params: [n],
  })

  await hre.network.provider.request({
    method: "evm_mine",
    params: [],
  })
}

describe("Token", async () => {
  let Token, token
  const NAME = "XIL"
  const SYMBOL = "XIL"
  // '0xcecb8f27f4200f3a000000' is the hex of (250000000 * 10 ** 18)
  // (0cecb8f27f4200f3a000000)16 = (250000000000000000000000000)10
  const TOTAL_SUPPLY = 250000000 * 10 ** 18
  const TOTAL_SUPPLY_HEX = "0xcecb8f27f4200f3a000000"
  let owner
  let addr1
  let addr2
  let addr3
  let treasuryAddr
  let pairAddr
  let addrs

  beforeEach(async () => {
    Token = await ethers.getContractFactory("XIL_BSC")
    ;[owner, addr1, addr2, addr3, treasuryAddr, idoAddr, pairAddr, ...addrs] =
      await ethers.getSigners()

    token = await Token.deploy()
  })

  describe("Checking correct deployment", () => {
    it("has a name", async () => {
      expect(await token.name()).to.equal(NAME)
    })

    it("has a symbol", async () => {
      expect(await token.symbol()).to.equal(SYMBOL)
    })

    it("default whitelist toggle parameter", async () => {
      expect(await token.applyWhitelist()).to.equal(false)
    })

    it("has a whitelist toggle parameter", async () => {
      expect(await token.applyWhitelist()).to.equal(false)
      await token.useWhitelist(true)
      expect(await token.applyWhitelist()).to.equal(true)
    })

    it("Should set the right owner", async () => {
      expect(await token.owner()).to.equal(owner.address)
    })

    it("has 18 decimals", async () => {
      expect(await token.decimals()).to.equal(18)
    })

    it("returns the total amount of tokens", async () => {
      const bigNumberTotalSupply = BigNumber.from(TOTAL_SUPPLY_HEX)
      const actualTotalSupply = await token.totalSupply()
      expect(actualTotalSupply).to.equal(bigNumberTotalSupply)
    })

    it("Should assign the total supply of tokens to the owner", async () => {
      const ownerBalance = await token.balanceOf(owner.address)
      expect(await token.totalSupply()).to.equal(ownerBalance)
    })
  })

  describe("Checking Ownership", () => {
    describe("transfer ownership", () => {
      it("changes owner after transfer", async () => {
        await expect(token.transferOwnership(treasuryAddr.address))
          .to.emit(token, "OwnershipTransferred")
          .withArgs(owner.address, treasuryAddr.address)
        expect(await token.owner()).to.equal(treasuryAddr.address)
      })

      it("prevents non-owners from transferring", async function () {
        await expect(
          token.connect(addr1).transferOwnership(treasuryAddr.address)
        ).to.be.revertedWith("caller is not the owner")
      })

      it("guards ownership against stuck state", async function () {
        await expect(token.transferOwnership(AddressZero)).to.be.revertedWith(
          "new owner is the zero address"
        )
      })
    })

    describe("renounce ownership", () => {
      it("renounce owner", async () => {
        await expect(token.renounceOwnership())
          .to.emit(token, "OwnershipTransferred")
          .withArgs(owner.address, AddressZero)
        expect(await token.owner()).to.equal(AddressZero)
      })

      it("renounce non owner", async () => {
        await expect(token.connect(addr1).renounceOwnership()).to.be.revertedWith(
          "caller is not the owner"
        )

        expect(await token.owner()).to.equal(owner.address)
      })
    })
  })

  describe("Transfer - Whitelist DEFAULT OFF", () => {
    it("Should transfer tokens between accounts", async () => {
      // Transfer 50 tokens from owner to addr1
      const amountOfTokens = 50
      await token.transfer(addr1.address, amountOfTokens)
      const addr1Balance = await token.balanceOf(addr1.address)
      expect(addr1Balance).to.equal(amountOfTokens)

      // Transfer 50 tokens from addr1 to addr2
      // We use .connect(signer) to send a transaction from another account
      await token.connect(addr1).transfer(addr2.address, 50)
      const addr2Balance = await token.balanceOf(addr2.address)
      expect(addr2Balance).to.equal(50)
    })

    it("Should transfer tokens with Transfer Event", async () => {
      // Transfer 50 tokens from owner to addr1
      const amountOfTokens = 50
      await expect(token.transfer(addr1.address, amountOfTokens))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, amountOfTokens)

      const addr1Balance = await token.balanceOf(addr1.address)
      expect(addr1Balance).to.equal(amountOfTokens)
    })

    it("Should fail if sender doesn’t have enough tokens", async () => {
      const initialOwnerBalance = await token.balanceOf(owner.address)

      // Try to send 1 token from addr1 (0 tokens) to owner (1000 tokens).
      // `require` will evaluate false and revert the transaction.
      await expect(token.connect(addr1).transfer(owner.address, 1)).to.be.revertedWith(
        "transfer amount exceeds balance"
      )

      // Owner balance shouldn't have changed.
      expect(await token.balanceOf(owner.address)).to.equal(initialOwnerBalance)
    })

    it("Should update balances after transfers", async () => {
      const initialOwnerBalance = await token.balanceOf(owner.address)
      const transferAmount1 = 100
      const transferAmount2 = 50
      const totalTransferAmount = BigNumber.from(transferAmount1 + transferAmount2)
      const finalOwnerAmount = initialOwnerBalance.sub(totalTransferAmount)

      // Transfer transferAmount1=100 tokens from owner to addr1.
      await token.transfer(addr1.address, transferAmount1)
      // Transfer another transferAmount2=50 tokens from owner to addr2.
      await token.transfer(addr2.address, transferAmount2)

      // Check balances.
      const finalOwnerBalance = await token.balanceOf(owner.address)
      expect(finalOwnerBalance).to.equal(finalOwnerAmount)

      const addr1Balance = await token.balanceOf(addr1.address)
      expect(addr1Balance).to.equal(100)

      const addr2Balance = await token.balanceOf(addr2.address)
      expect(addr2Balance).to.equal(50)
    })

    it("Should batch transfer tokens between accounts", async () => {
      // Batvh Transfer tokens to addr1  addr2 and addr3
      const batchTransferData = [
        { recipient: addr1.address, amount: 50 },
        { recipient: addr2.address, amount: 150 },
        { recipient: addr3.address, amount: 250 },
      ]
      await token.batchTransfer(batchTransferData)
      expect(await token.balanceOf(addr1.address)).to.equal(50)
      expect(await token.balanceOf(addr2.address)).to.equal(150)
      expect(await token.balanceOf(addr3.address)).to.equal(250)
    })
  })

  describe("when the recipient is the zero address (TOKEN IS NOT BURNABLE)", () => {
    beforeEach(async () => {
      let spender = addr2
      let tokenOwner = owner
      const initialSupply = 250000000
      // Owner (default user) approves the spender to spend initialSupply
      await token.approve(spender.address, initialSupply)
    })

    it("reverts transferFrom", async () => {
      const amount = 123456
      let tokenOwner = owner
      let spender = addr2
      await expect(
        token.connect(spender).transferFrom(tokenOwner.address, AddressZero, amount)
      ).to.be.revertedWith("transfer to the zero address")
    })

    it("reverts transfer", async () => {
      const amount = 123456
      let tokenOwner = owner
      let spender = addr2
      await expect(token.transfer(AddressZero, amount)).to.be.revertedWith(
        "transfer to the zero address"
      )
    })
  })

  describe("Approvals - Whitelist DEFAULT OFF", () => {
    describe("when the spender has enough approved balance", () => {
      beforeEach(async () => {
        let spender = addr2
        let tokenOwner = owner
        const initialSupply = 250000000
        // Owner (default user) approves the spender to spend initialSupply
        await token.approve(spender.address, initialSupply)
      })

      describe("when the token owner has enough balance", () => {
        it("transfers the requested amount", async () => {
          let tokenOwner = owner
          let to = addr3
          let spender = addr2
          let amount = 25000

          let ownerOriginalBalance = await token.balanceOf(tokenOwner.address)
          expect(await token.balanceOf(to.address)).to.equal(0)
          // Do transferForm
          await token.connect(spender).transferFrom(tokenOwner.address, to.address, amount)
          //Check correct amounts have been transfered
          expect(await token.balanceOf(tokenOwner.address)).to.equal(
            ownerOriginalBalance.sub(amount)
          )
          expect(await token.balanceOf(to.address)).to.equal(amount)
        })

        it("check decreases the spender allowance", async () => {
          let tokenOwner = owner
          let to = addr3
          let spender = addr2
          let amount = 25000
          let tokenAllowanceBalance = 250000000
          await token.connect(spender).transferFrom(tokenOwner.address, to.address, amount)
          expect(await token.allowance(tokenOwner.address, spender.address)).to.equal(
            tokenAllowanceBalance - amount
          )
        })

        it("check fails to overspend the spender allowance", async () => {
          let tokenOwner = owner
          let to = addr3
          let spender = addr2
          let amount = 2500000001
          let tokenAllowanceBalance = 250000000

          await expect(
            token.connect(spender).transferFrom(tokenOwner.address, to.address, amount)
          ).to.be.revertedWith("transfer amount exceeds allowance")
        })

        it("emits a transfer event", async () => {
          let tokenOwner = owner
          let to = addr3
          let spender = addr2
          let amountOfTokens = 25000

          await expect(
            token.connect(spender).transferFrom(tokenOwner.address, to.address, amountOfTokens)
          )
            .to.emit(token, "Transfer")
            .withArgs(tokenOwner.address, to.address, amountOfTokens)
        })

        it("emits an approval event", async () => {
          let spender1 = addr1
          let tokenOwner = owner
          const amountOfTokens = 123456

          await expect(token.approve(spender1.address, amountOfTokens))
            .to.emit(token, "Approval")
            .withArgs(tokenOwner.address, spender1.address, amountOfTokens)
        })
      })

      describe("when the token owner does not have enough balance", () => {
        it("reverts", async () => {
          let spender = addr2
          let tokenOwner = addr1
          let to = addr3
          const approvalAmount = 250000000
          let amountOfTokens = 25000
          // Token owner is empty walletbut approval to spend
          await token.connect(tokenOwner).approve(spender.address, approvalAmount)

          await expect(
            token.connect(spender).transferFrom(tokenOwner.address, to.address, amountOfTokens)
          ).to.be.revertedWith("transfer amount exceeds balance")
        })
      })
    })
  })

  describe("Transactions - Whitelist ENABLED but EMPTY", () => {
    // Should be the same as no white list (but higher gas costs)

    beforeEach(async () => {
      await token.useWhitelist(true)
    })

    it("Should transfer tokens between accounts", async () => {
      // Transfer 50 tokens from owner to addr1
      await token.transfer(addr1.address, 50)
      const addr1Balance = await token.balanceOf(addr1.address)
      expect(addr1Balance).to.equal(50)

      // Transfer 50 tokens from addr1 to addr2
      // We use .connect(signer) to send a transaction from another account
      await token.connect(addr1).transfer(addr2.address, 50)
      const addr2Balance = await token.balanceOf(addr2.address)
      expect(addr2Balance).to.equal(50)
    })
  })

  describe("Checking WhiteLister controls", () => {
    describe("transfer whitelister", () => {
      it("changes whitelist after transfer", async () => {
        await expect(token.transferWhitelister(treasuryAddr.address))
          .to.emit(token, "WhitelisterTransferred")
          .withArgs(owner.address, treasuryAddr.address)
      })

      it("prevents non-owners from transferring whitelist", async () => {
        await expect(
          token.connect(addr1).transferWhitelister(treasuryAddr.address)
        ).to.be.revertedWith("Caller is not the whitelister")
      })

      it("guards whitelist ownership against stuck state", async () => {
        await expect(token.transferWhitelister(AddressZero)).to.be.revertedWith(
          "New whitelister is the zero address"
        )
      })
    })

    describe("renounce ownership", () => {
      it("renounce owner", async () => {
        await expect(token.renounceWhitelister())
          .to.emit(token, "WhitelisterTransferred")
          .withArgs(owner.address, AddressZero)
      })

      it("renounce non owner", async () => {
        await expect(token.connect(addr1).renounceWhitelister()).to.be.revertedWith(
          "Caller is not the whitelister"
        )
      })
    })
  })

  describe("Transactions - Whitelist POPULATED", () => {
    // Should be the same as no white list (but reduced gas costs)

    beforeEach(async () => {
      await token.useWhitelist(true)
      const idoAllotment = 125000000

      await token.transferWhitelister(idoAddr.address)
      await token.approve(idoAddr.address, idoAllotment)
    })

    it("Should reject bad whiteList data", async () => {
      let durations = [1200]
      let amountsMax = [1000000, 10]
      // number of durations and amounts need to match
      await expect(
        token.connect(idoAddr).createLGEWhitelist(addr1.address, durations, amountsMax)
      ).to.be.revertedWith("revert Invalid whitelist(s)")
    })

    it("transferring tokens to the ido address begins the LGE", async () => {
      // Array length, is the number of rounds.
      let durations = [1200000] //time in seconds
      let amountsMax = [1000000] //tokens available

      // number of durations and amounts need to match (set white list on this address (only one address for whitelisting transfers))
      await token.connect(idoAddr).createLGEWhitelist(idoAddr.address, durations, amountsMax)

      // Set who can access the whitelist round
      const addresses = [
        pairAddr.address,
        idoAddr.address,
        owner.address,
        addr1.address,
        addr2.address,
      ]
      await token.connect(idoAddr).modifyLGEWhitelist(0, 1200, 50000000, addresses, true)

      // activate LGE (ido account can enableß)
      await token.connect(idoAddr).transferFrom(owner.address, idoAddr.address, 1000000)

      // console.log("getLGEWhitelistRound", await token.getLGEWhitelistRound());
      // Does a valid whitelist transaction
      await token.connect(idoAddr).transfer(addr2.address, 1000)
      expect(await token.balanceOf(addr2.address)).to.equal(1000)

      // Whitelisting only applies to the idoAdd address
      await expect(token.connect(idoAddr).transfer(addr3.address, 1000)).to.be.revertedWith(
        "Buyer is not whitelisted"
      )

      // other accounts can still transfer
      await expect(token.connect(addr2).transfer(addr3.address, 100)).to.not.be.reverted
      await expect(token.transfer(addr3.address, 100)).to.not.be.reverted
    })

    it("DISABLE WHITELISTING - transferring tokens to the ido address begins the LGE", async () => {
      //DISABLE WHITELISTING

      await token.useWhitelist(false)
      // Array length, is the number of rounds.
      let durations = [1200] //time in seconds
      let amountsMax = [1000000] //tokens available

      // number of durations and amounts need to match (set white list on this address (only one address for whitelisting transfers))
      await token.connect(idoAddr).createLGEWhitelist(idoAddr.address, durations, amountsMax)

      // Set who can access the whitelist round
      const addresses = [
        pairAddr.address,
        idoAddr.address,
        owner.address,
        addr1.address,
        addr2.address,
      ]
      await token.connect(idoAddr).modifyLGEWhitelist(0, 1200, 50000000, addresses, true)

      // activate LGE (ido account can enableß)
      await token.connect(idoAddr).transferFrom(owner.address, idoAddr.address, 1000000)

      // console.log("getLGEWhitelistRound", await token.getLGEWhitelistRound());
      // Does a valid whitelist transaction
      await token.connect(idoAddr).transfer(addr2.address, 1000)
      expect(await token.balanceOf(addr2.address)).to.equal(1000)

      // Whitelisting only applies to the idoAdd address (DISABLE WHITELISTING)
      await expect(token.connect(idoAddr).transfer(addr3.address, 1000)).to.not.be.reverted

      // other accounts can still transfer
      await expect(token.connect(addr2).transfer(addr3.address, 100)).to.not.be.reverted
      await expect(token.transfer(addr3.address, 100)).to.not.be.reverted
    })

    it("when the whitelist round is over, getLGEWhitelistRound returns 0", async () => {
      let durations = [1200] //time in seconds
      let amountsMax = [1000000] //tokens available

      // number of durations and amounts need to match (set white list on this address (only one address for whitelisting transfers))
      await token.connect(idoAddr).createLGEWhitelist(idoAddr.address, durations, amountsMax)

      // activate LGE (ido account can enable)
      await token.connect(idoAddr).transferFrom(owner.address, idoAddr.address, 1000000)

      let data = await token.getLGEWhitelistRound()
      await expect(token.connect(idoAddr).transfer(addr3.address, 1000)).to.be.reverted
      expect(data[0]).to.be.equal(1)
      await increaseTime(1201)
      // Check that the white list expiry is working
      data = await token.getLGEWhitelistRound()
      // console.log("getLGEWhitelistRound", data);
      expect(data[0]).to.be.equal(BigNumber.from(0))
      await expect(token.connect(idoAddr).transfer(addr3.address, 1000)).to.not.be.reverted
    })

    it("whitelist modification testing", async () => {
      // Array length, is the number of rounds.
      let durations = [1200000] //time in seconds
      let amountsMax = [1000000] //tokens available

      // number of durations and amounts need to match (set white list on this address (only one address for whitelisting transfers))
      await token.connect(idoAddr).createLGEWhitelist(idoAddr.address, durations, amountsMax)

      // Set who can access the whitelist round
      let addresses = [
        pairAddr.address,
        idoAddr.address,
        owner.address,
        addr1.address,
        addr2.address,
      ]
      await token.connect(idoAddr).modifyLGEWhitelist(0, 1200, 50000000, addresses, true)

      // activate LGE (ido account can enableß)
      await token.connect(idoAddr).transferFrom(owner.address, idoAddr.address, 1000000)

      // console.log("getLGEWhitelistRound", await token.getLGEWhitelistRound());
      // Does a valid whitelist transaction
      await token.connect(idoAddr).transfer(addr2.address, 1000)
      expect(await token.balanceOf(addr2.address)).to.equal(1000)

      // Whitelisting only applies to the idoAdd address
      await expect(token.connect(idoAddr).transfer(addr3.address, 1000)).to.be.revertedWith(
        "Buyer is not whitelisted"
      )

      // other accounts can still transfer
      await expect(token.connect(addr2).transfer(addr3.address, 100)).to.not.be.reverted
      await expect(token.transfer(addr3.address, 100)).to.not.be.reverted

      // Set who can access the whitelist round (turn off access to addr2)
      addresses = [addr2.address]
      await token.connect(idoAddr).modifyLGEWhitelist(0, 1200, 50000000, addresses, false)

      // Whitelisting only applies to the idoAdd address
      await expect(token.connect(idoAddr).transfer(addr1.address, 1000)).to.not.be.reverted
      await expect(token.connect(idoAddr).transfer(addr2.address, 1000)).to.be.revertedWith(
        "Buyer is not whitelisted"
      )
      await expect(token.connect(idoAddr).transfer(addr3.address, 1000)).to.be.revertedWith(
        "Buyer is not whitelisted"
      )
    })

    it("whitelist amountsMax spending testing", async () => {
      // Array length, is the number of rounds.
      let durations = [1200] //time in seconds
      let amountsMax = [150] //tokens available

      // number of durations and amounts need to match (set white list on this address (only one address for whitelisting transfers))
      await token.connect(idoAddr).createLGEWhitelist(idoAddr.address, durations, amountsMax)

      // Set who can access the whitelist round
      let addresses = [
        pairAddr.address,
        idoAddr.address,
        owner.address,
        addr1.address,
        addr2.address,
      ]
      await token.connect(idoAddr).modifyLGEWhitelist(0, 1200, 150, addresses, true)
      // activate LGE (ido account can enableß)
      await token.connect(idoAddr).transferFrom(owner.address, idoAddr.address, 1000000)

      await expect(token.connect(idoAddr).transfer(addr1.address, 1000)).to.be.revertedWith(
        "Amount exceeds whitelist maximum"
      )
      await expect(token.connect(idoAddr).transfer(addr1.address, 100)).to.not.be.reverted

      addresses = [addr2.address]
      await token.connect(idoAddr).modifyLGEWhitelist(0, 1200, 500, addresses, true)
      // 100 + 300 < 500
      await expect(token.connect(idoAddr).transfer(addr1.address, 200)).to.not.be.reverted
      // 100 + 300 > 300 (so no more transactions)
      await token.connect(idoAddr).modifyLGEWhitelist(0, 1200, 300, addresses, true)
      await expect(token.connect(idoAddr).transfer(addr1.address, 20)).to.be.revertedWith(
        "Amount exceeds whitelist maximum"
      )
    })
  })

  describe("Token burning", () => {
    it("Should burn token decreasing supply", async () => {
      const startTotalSupply = await token.totalSupply()
      const startBalance = await token.balanceOf(owner.address)

      const amountOfTokens = BigNumber.from("100000")
      await token.burn(amountOfTokens)

      const endTotalSupply = await token.totalSupply()
      const endBalance = await token.balanceOf(owner.address)

      expect(endTotalSupply).to.equal(startTotalSupply.sub(amountOfTokens))
      expect(endBalance).to.equal(startBalance.sub(amountOfTokens))
    })

    it("Should prevent token burning when the caller does not have funds to burn", async () => {
      const amountOfTokens = BigNumber.from("100000")
      await expect(token.connect(addr1).burn(amountOfTokens)).to.be.revertedWith(
        "BEP20: burn amount exceeds balance"
      )
    })

    it("Should allow burning from an authorized third party", async () => {
      const startTotalSupply = await token.totalSupply()
      const startBalance = await token.balanceOf(owner.address)

      const amountOfTokens = BigNumber.from("100000")
      await token.approve(addr1.address, amountOfTokens)
      await token.connect(addr1).burnFrom(owner.address, amountOfTokens)

      const endTotalSupply = await token.totalSupply()
      const endBalance = await token.balanceOf(owner.address)

      expect(endTotalSupply).to.equal(startTotalSupply.sub(amountOfTokens))
      expect(endBalance).to.equal(startBalance.sub(amountOfTokens))
    })

    it("Should prevent burning from an unauthorized third party", async () => {
      const amountOfTokens = BigNumber.from("100000")
      await expect(token.connect(addr1).burnFrom(owner.address, amountOfTokens)).to.be.revertedWith(
        "BEP20: burn amount exceeds allowance"
      )
    })
  })
})
