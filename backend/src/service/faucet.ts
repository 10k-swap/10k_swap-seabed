import { utils } from 'ethers'
import { Abi, Account, Call, num, uint256 } from 'starknet'
import { In } from 'typeorm'
import { faucetConfig } from '../config'
import erc20 from '../config/abis/erc20.json'
import { TwitterCrawl } from '../model/twitter_crawl'
import { isAddress, sleep } from '../util'
import { Core } from '../util/core'
import { accessLogger, errorLogger } from '../util/logger'
import { RpcsService } from './rpcs'

export class FaucetService {
  private static accountWorking: { [key: string]: boolean } = {}

  constructor() {}

  async fromTwitter() {
    const accounts = this.getAccounts()
    if (accounts.length < 1) {
      errorLogger.error('FromTwitter failed: Miss accounts')
      return
    }

    const accountTweetQuantity = 20
    const noWorkingAccounts = accounts.filter(
      (item) => FaucetService.accountWorking[item.address] !== true
    )
    if (noWorkingAccounts.length < 1) {
      return
    }

    const tweets = await Core.db.getRepository(TwitterCrawl).find({
      where: { status: 0 },
      take: accountTweetQuantity * noWorkingAccounts.length,
      order: { tweet_time: 'ASC' },
    })

    let start = 0
    for (const account of noWorkingAccounts) {
      const end = start + accountTweetQuantity
      const groupTweets = tweets.slice(start, end)

      this.sendTokens(account, groupTweets)

      // Reduce "Too Many Requests" prompts
      await sleep(5000)

      start = end
    }
  }

  private async sendTokens(account: Account, tweets: TwitterCrawl[]) {
    const repository = Core.db.getRepository(TwitterCrawl)

    const recipients: string[] = []
    const tweet_ids: string[] = []
    for (const tweet of tweets) {
      const recipient = this.getAddress(tweet.content)
      if (recipient) {
        recipients.push(recipient)
        tweet_ids.push(tweet.tweet_id)

        // Update status=3(fauceting)
        await repository.update(
          { tweet_id: tweet.tweet_id },
          { recipient, status: 3 }
        )
      } else {
        await repository.update({ tweet_id: tweet.tweet_id }, { status: 2 })
      }
    }

    // Check recipients
    if (recipients.length === 0) {
      return
    }

    // Set account working
    FaucetService.accountWorking[account.address] = true

    try {
      await this.execute(account, recipients)
      await repository.update({ tweet_id: In(tweet_ids) }, { status: 1 })
    } catch (error) {
      // Retry "Too Many Requests" | "nonce invalid" | "nonce is invalid" errors
      const retry = /(Too Many Requests|nonce invalid|nonce is invalid)/gi.test(
        error.message
      )

      if (retry) {
        // Retry
        await repository.update({ tweet_id: In(tweet_ids) }, { status: 0 })
      } else {
        errorLogger.error(
          `Execute fail: ${error.message}. Account: ${account.address}`
        )
        await repository.update({ tweet_id: In(tweet_ids) }, { status: 2 })
      }
    } finally {
      // Set account no working
      FaucetService.accountWorking[account.address] = false
    }
  }

  private async execute(account: Account, recipients: string[]) {
    const { aAddress, aAmount, bAddress, bAmount, ethAddress, ethAmount } =
      faucetConfig

    // TODO: Test
    const a = uint256.bnToUint256(aAmount.toString())
    const b = uint256.bnToUint256(bAmount.toString())
    const eth = uint256.bnToUint256(ethAmount.toString())

    const calls: Call[] = []
    const abis: Abi[] = []
    for (const recipient of recipients) {
      calls.push({
        contractAddress: aAddress,
        entrypoint: 'transfer',
        calldata: [recipient, a.low, a.high],
      })
      abis.push(erc20 as Abi)

      calls.push({
        contractAddress: bAddress,
        entrypoint: 'transfer',
        calldata: [recipient, b.low, b.high],
      })
      abis.push(erc20 as Abi)

      calls.push({
        contractAddress: ethAddress,
        entrypoint: 'transfer',
        calldata: [recipient, eth.low, eth.high],
      })
      abis.push(erc20 as Abi)
    }

    const faucetResp = await account.execute(calls, abis, {
      maxFee: utils.parseEther('0.01') + '',
    })

    accessLogger.info('Faucet transaction_hash:', faucetResp.transaction_hash)
    await account.waitForTransaction(faucetResp.transaction_hash)
    accessLogger.info('Transaction_hash fauceted:', faucetResp.transaction_hash)
  }

  private getAccounts() {
    const accounts: Account[] = []

    for (const i in faucetConfig.privateKeys) {
      const privateKey = faucetConfig.privateKeys[i]
      const address = faucetConfig.accounts[i]
      if (!privateKey || !address) {
        continue
      }

      // TODO: test
      accounts.push(
        new Account(
          new RpcsService().alchemyRpcProvider(),
          address.toLowerCase(),
          num.toHex(privateKey)
        )
      )
    }
    return accounts
  }

  private getAddress(content: string): string | undefined {
    const reg = new RegExp(/0x[a-fA-F0-9]{60,66}/gi)
    const address = content.match(reg)?.[0]

    return isAddress(address) ? address : undefined
  }
}
