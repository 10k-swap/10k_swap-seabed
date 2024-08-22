import { hash } from 'starknet'

export const ADDRESS_ZORE =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

export const PAIR_CREATED_EVENT_KEY = hash.getSelectorFromName('PairCreated')

export const STRK_TOKEN_INFO = {
  name: 'Starknet Token',
  symbol: 'STRK',
  decimals: 18,
}
