import dayjs from 'dayjs'
import {
  BigNumberish,
  Provider,
  constants,
  num,
  validateAndParseAddress,
} from 'starknet'
import { ADDRESS_ZORE } from '../constants'
import { RpcsService } from '../service/rpcs'
import { BigNumber } from 'ethers'

export async function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(null)
    }, ms)
  })
}

/**
 * Normal format date: (YYYY-MM-DD HH:mm:ss)
 * @param date Date
 * @returns
 */
export function dateFormatNormal(
  date: string | number | Date | dayjs.Dayjs | null | undefined
): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

/**
 * String equals ignore case
 * @param value1
 * @param value2
 * @returns
 */
export function equalsIgnoreCase(value1: string, value2: string): boolean {
  if (typeof value1 !== 'string' || typeof value2 !== 'string') {
    return false
  }

  if (value1 == value2) {
    return true
  }
  if (value1.toUpperCase() == value2.toUpperCase()) {
    return true
  }

  return false
}

/**
 *
 * @param tokenAddress when tokenAddress=/^0x0+$/i
 * @returns
 */
export function isEthTokenAddress(tokenAddress: string) {
  return /^0x0+$/i.test(tokenAddress)
}

/**
 * @param chainId
 * @returns
 */
export function isSupportEVM(chainId: number) {
  return [1, 2, 6, 7, 5, 22, 66, 77].indexOf(Number(chainId)) > -1
}

/**
 * @param promiseer
 * @param retryTotal
 * @param duration
 * @returns
 */
export async function doWithRetry<T>(
  promiseer: () => Promise<T>,
  retryTotal = 3,
  duration = 1000
) {
  for (let index = 1; index <= retryTotal; index++) {
    try {
      return await promiseer()
    } catch (err) {
      if (index >= retryTotal) {
        throw err
      }

      if (duration > 0) {
        await sleep(duration)
      }
    }
  }
  return undefined
}

export function isAddress(address: any): string | false {
  try {
    const parsed = validateAndParseAddress(address)
    return parsed === ADDRESS_ZORE ? false : address
  } catch (error) {
    return false
  }
}

export function isDevelopEnv() {
  const productEnv = process.env['PRODUCT_ENV'] || ''
  return productEnv.toLowerCase() != 'production'
}

/**
 * @deprecated
 * @returns
 */
export function getProviderByEnv() {
  return new Provider({
    sequencer: {
      network: isDevelopEnv()
        ? constants.StarknetChainId.SN_GOERLI
        : constants.StarknetChainId.SN_MAIN,
    },
  })
}

export function getRpcProviderByEnv() {
  return new RpcsService().defaultRpcProvider()
}

export function isRpcTooManyRequests(err: Error) {
  return /(Too Many Requests)/gi.test(err.message)
}

export function bigNumberishToUtf8(value: BigNumberish) {
  return Buffer.from(num.hexToBytes(num.toHex(value))).toString('utf-8')
}

export function get10kStartBlockByEnv() {
  return isDevelopEnv() ? 317000 : 4000
}

export function equalBN(bn0: BigNumberish, bn1: BigNumberish) {
  return BigNumber.from(bn0).eq(bn1)
}
