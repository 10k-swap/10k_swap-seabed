import { MerkleTree } from '../src/service/merkle_tree'
import { Restful } from '../src/util/restful'

declare module 'koa' {
  interface DefaultContext {
    restful: Restful
  }
}

interface CumulativeAllocation {
  address: string
  cumulative_amount: bigint
}

interface FileNameInfo {
  full_path: string
  round: number
}

interface RoundTreeData {
  /// Which round
  round: number
  /// Cumulative amounts for each address in a Merkle tree
  tree: MerkleTree
  /// The accumulated amount of tokens to be distributed in a round. Includes amounts from all previous rounds
  accumulated_total_amount: bigint
  /// The total amount of tokens to be distributed in a round. Includes amounts only from one round
  round_total_amount: bigint
}

interface JSONAllocation {
  address: string
  amount: string
}

interface RoundAmounts {
  round: number
  amounts: Array<JSONAllocation>
}

interface RoundAmountMaps {
  round: number
  round_amounts: Map<string, bigint>
  cumulative_amounts: Map<string, bigint>
}
