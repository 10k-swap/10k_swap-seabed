import PromisePool from '@supercharge/promise-pool'
import fse from 'fs-extra'
import path from 'path'
import unzipper from 'unzipper'
import {
  CumulativeAllocation,
  FileNameInfo,
  JSONAllocation,
  RoundAmountMaps,
  RoundAmounts,
  RoundTreeData,
} from '../../typings'
import { accessLogger } from '../util/logger'
import { get_all_data } from './data_storage'
import { MerkleTree } from './merkle_tree'

async function retrieve_valid_files(filepath: string) {
  const valid_files: FileNameInfo[] = []
  const dir_path = path.resolve(filepath)

  // Case insensitive, find pattern
  const template_pattern = /^raw_(\d+)\.zip$/i

  const entries = await fse.readdir(dir_path, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isFile()) {
      const match = entry.name.match(template_pattern)
      if (match) {
        const round = parseInt(match[1], 10)

        // Don't allow round 0
        if (round !== 0) {
          valid_files.push({
            full_path: path.join(dir_path, entry.name),
            round: round,
          })
        }
      }
    }
  }

  accessLogger.info(`Found ${valid_files.length} valid input files`)
  return valid_files
}

function map_cumulative_amounts(allocations: RoundAmounts[]) {
  const all_rounds_cums = new Map<string, bigint>()
  const round_maps: RoundAmountMaps[] = []

  for (const allocation of allocations) {
    const curr_round_amounts = new Map<string, bigint>()

    for (const data of allocation.amounts) {
      let amount: bigint
      try {
        amount = BigInt(data.amount)
        amount = amount < 0n ? 0n : amount
      } catch {
        amount = 0n
      }

      const field = data.address

      curr_round_amounts.set(
        field,
        (curr_round_amounts.get(field) || 0n) + amount
      )

      all_rounds_cums.set(field, (all_rounds_cums.get(field) || 0n) + amount)
    }

    const map: RoundAmountMaps = {
      round: allocation.round,
      round_amounts: curr_round_amounts,
      cumulative_amounts: new Map(all_rounds_cums),
    }

    round_maps.push(map)
  }

  return round_maps
}

async function transform_allocations_to_cumulative_rounds(
  allocations: RoundAmounts[]
) {
  const rounds: RoundTreeData[] = []

  if (allocations.length == 0) return rounds

  allocations.sort((a, b) => a.round - b.round)

  const cumulative_amount_maps = map_cumulative_amounts(allocations)

  const results = (
    await PromisePool.withConcurrency(1)
      .for(cumulative_amount_maps)
      .handleError((e) => {
        throw e
      })
      .process(async (cum_map, index) => {
        let round_total_amount = BigInt(0)

        const curr_round_data: CumulativeAllocation[] = []
        const entries = cum_map.cumulative_amounts.entries()
        while (true) {
          const current = entries.next()
          if (current.done) break

          const [address, cumulative_amount] = current.value

          const amount = cum_map.round_amounts.get(address) || 0n
          round_total_amount += amount

          curr_round_data.push({
            address,
            cumulative_amount,
          })
        }

        const sorted_curr_round_data = curr_round_data
        sorted_curr_round_data.sort((a, b) =>
          a.address.localeCompare(b.address)
        )

        const startTime = new Date().getTime()
        const tree = await MerkleTree.new(sorted_curr_round_data)
        accessLogger.info(
          `Round: ${cum_map.round}, create MerkleTree use time: ${
            new Date().getTime() - startTime
          }ms`
        )

        return {
          result: [cum_map.round, tree, round_total_amount] as [
            number,
            MerkleTree,
            bigint
          ],
          index,
        }
      })
  ).results
    .sort((a, b) => a.index - b.index)
    .map((item) => item.result)

  let accumulated_total_amount = BigInt(0)
  for (const item of results) {
    const [round, tree, round_total_amount] = item

    accumulated_total_amount += round_total_amount

    let round_drop: RoundTreeData = {
      round,
      tree,
      accumulated_total_amount,
      round_total_amount,
    }

    accessLogger.info(`
Extracted data from round ${round}:
      Round total token amount: ${round_drop.round_total_amount},
      Cumulative token amount: ${round_drop.accumulated_total_amount},
      round_drop.tree.root: ${round_drop.tree.root.value}
      `)

    rounds.push(round_drop)
  }

  return rounds
}

export async function read_allocations(filepath: string) {
  const files = await retrieve_valid_files(filepath)
  const round_amounts: RoundAmounts[] = []

  for (const file of files) {
    const directory = await unzipper.Open.file(file.full_path)

    if (directory.files.length > 0) {
      const archive_file = directory.files[0]
      const buffer = await archive_file.buffer()

      const allocation: JSONAllocation[] = JSON.parse(buffer.toString())

      const round_amount: RoundAmounts = {
        amounts: allocation,
        round: file.round,
      }
      accessLogger.info(
        `Round: ${file.round}, round_amount.length: ${round_amount.amounts.length}`
      )

      round_amounts.push(round_amount)
    }
  }

  return await transform_allocations_to_cumulative_rounds(round_amounts)
}

export async function get_round_data(round: number) {
  const round_data = await get_all_data()

  const use_round = round > 0 ? round : round_data[round_data.length - 1].round
  if (!use_round) {
    throw new Error('No allocation data found')
  }

  const relevant_data = round_data.find((item) => item.round == use_round)
  if (!relevant_data) {
    throw new Error('No allocation data available')
  }

  return relevant_data
}

export async function get_raw_calldata(round: number, address: string) {
  const relevant_data = await get_round_data(round)

  const result = relevant_data.tree.address_calldata(address)

  return result
}

export async function get_raw_root(round: number) {
  const relevant_data = await get_round_data(round)

  return {
    root: relevant_data.tree.root.value,
    accumulated_total_amount: relevant_data.accumulated_total_amount + '',
    round_total_amount: relevant_data.round_total_amount + '',
  }
}
