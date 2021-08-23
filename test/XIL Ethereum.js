const { expect } = require("chai")
const { BigNumber } = require("@ethersproject/bignumber")
const { AddressZero } = require("@ethersproject/constants")

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
    Token = await ethers.getContractFactory("XIL_ETH")
    ;[owner, addr1, addr2, addr3, treasuryAddr, pairAddr, ...addrs] = await ethers.getSigners()

    token = await Token.deploy()
  })

  describe("Checking correct deployment", () => {
    it("has a name", async () => {
      expect(await token.name()).to.equal(NAME)
    })

    it("has a symbol", async () => {
      expect(await token.symbol()).to.equal(SYMBOL)
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
  })
})
