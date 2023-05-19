import abiErc20 from './abis/erc20.json'
import abil0kFactory from './abis/l0k_factory.json'
import abil0kPair from './abis/l0k_pair.json'
import abil0kRouter from './abis/l0k_router.json'

export const abis = {
  erc20: abiErc20,
  l0kFactory: abil0kFactory,
  l0kPair: abil0kPair,
  l0kRouter: abil0kRouter,
}

export const addresses = {
  mainnet: {
    parirClassHash:
      '0x231adde42526bad434ca2eb983efdd64472638702f87f97e6e3c084f264e06f',
    factory:
      '0x01c0a36e26a8f822e0d81f20a5a562b16a8f8a3dfd99801367dd2aea8f1a87a2',
    router:
      '0x07a6f98c03379b9513ca84cca1373ff452a7462a3b61598f0af5bb27ad7f76d1',
  },

  goerli: {
    parirClassHash:
      '0x231adde42526bad434ca2eb983efdd64472638702f87f97e6e3c084f264e06f',
    factory:
      '0x06c31f39524388c982045988de3788530605ed08b10389def2e7b1dd09d19308',
    router:
      '0x00975910cd99bc56bd289eaaa5cee6cd557f0ddafdb2ce6ebea15b158eb2c664',
  },
}
