import PromisePool from '@supercharge/promise-pool'
import { toBeHex, toBigInt } from 'ethers'
import { pedersen_from_hex } from 'pedersen-fast'
import * as starknet from 'starknet'
import { CumulativeAllocation } from '../../typings'
import { Core } from '../util/core'

export class MerkleTree {
  public root: Node
  public allocations: CumulativeAllocation[]

  public static async new(allocations: CumulativeAllocation[]) {
    if (allocations.length == 0) {
      throw new Error('No data for merkle tree')
    }

    const leaves = (
      await PromisePool.withConcurrency(50)
        .for(allocations)
        .handleError((e) => {
          throw e
        })
        .process(async (a, index) => ({
          result: await Node.new_leaf(a),
          index,
        }))
    ).results
      .sort((a, b) => a.index - b.index)
      .map((item) => item.result)

    // if odd length add a copy of last elem
    if (leaves.length % 2 == 1) {
      leaves.push(leaves[leaves.length - 1])
    }

    let root = await build_tree(leaves)

    const m = new MerkleTree()
    m.root = root
    m.allocations = allocations

    return m
  }

  public address_calldata(address: string) {
    if (!this.root.accessible_addresses.has(address)) {
      throw new Error(`Address not found in tree: ${address}`)
    }

    let hashes: string[] = []
    let current_node = this.root
    // if either child is_some, then both is_some
    while (true) {
      const left = current_node.left_child!
      const right = current_node.right_child!

      if (left.accessible_addresses.has(address)) {
        hashes.push(right.value)
        current_node = left
      } else {
        hashes.push(left.value)
        current_node = right
      }

      if (!current_node.left_child) {
        break
      }
    }

    // reverse to leaf first root last
    hashes = hashes.reverse()

    const allocation = this.allocations.find((item) => item.address == address)!

    return {
      amount: toBeHex(allocation.cumulative_amount),
      proof: hashes,
    }
  }
}

export class Node {
  private static LEAF_POSEIDON = 'leaf_poseidon'
  private static NODE_PEDERSEN = 'node_pedersen'

  public left_child?: Node
  public right_child?: Node
  public accessible_addresses: Set<string>
  public value: string

  public static async new(a: Node, b: Node) {
    const [left_child, right_child] =
      toBigInt(a.value) < toBigInt(b.value) ? [a, b] : [b, a]

    const hKey = `${left_child.value}_${right_child.value}`
    let value = await Core.redis.hget(Node.NODE_PEDERSEN, hKey)
    if (!value) {
      value = pedersen_from_hex(left_child.value, right_child.value)
      await Core.redis.hset(Node.NODE_PEDERSEN, hKey, value)
    }

    const accessible_addresses = new Set<string>(
      left_child.accessible_addresses
    )

    for (const value of right_child.accessible_addresses.values()) {
      accessible_addresses.add(value)
    }

    const node = new Node()
    node.left_child = left_child
    node.right_child = right_child
    node.accessible_addresses = accessible_addresses
    node.value = value

    return node
  }

  public static async new_leaf(allocation: CumulativeAllocation) {
    const address = allocation.address

    const hKey = `${address}_${allocation.cumulative_amount}`

    // keep order address, amount
    let value = await Core.redis.hget(Node.LEAF_POSEIDON, hKey)
    if (!value) {
      value = starknet.hash.computePoseidonHash(
        address,
        allocation.cumulative_amount
      )

      await Core.redis.hset(Node.LEAF_POSEIDON, hKey, value)
    }

    const node = new Node()
    node.accessible_addresses = new Set([address])
    node.value = value + ''

    return node
  }
}

async function build_tree_recursively(nodes: Node[]) {
  if (nodes.length == 0) {
    throw new Error('Failed building the tree')
  }

  const abs: [Node, Node][] = []
  while (nodes.length > 0) {
    let a = nodes.pop()!
    let b = nodes.pop()!

    abs.push([a, b])
  }
  const next_nodes = (
    await PromisePool.withConcurrency(50)
      .for(abs)
      .handleError((e) => {
        throw e
      })
      .process(async (ab, index) => ({
        result: await Node.new(ab[0], ab[1]),
        index,
      }))
  ).results
    .sort((a, b) => a.index - b.index)
    .map((item) => item.result)

  // let next_nodes: Node[] = []
  // const temp_abs: [Node, Node][] = []
  // for (let i = 0; i < abs.length; i++) {
  //   temp_abs.push(abs[i])

  //   if (temp_abs.length == 1 || i == abs.length - 1) {
  //     next_nodes = next_nodes.concat(
  //       await Promise.all(
  //         temp_abs.map(async (ab) => await Node.new(ab[0], ab[1]))
  //       )
  //     )

  //     // Clear
  //     temp_abs.length = 0
  //   }
  // }

  // const next_nodes = await Promise.all(
  //   abs.map(async (ab) => await Node.new(ab[0], ab[1]))
  // )

  if (next_nodes.length == 1) {
    // return root
    let root = next_nodes.pop()
    return root
  }

  if (next_nodes.length % 2 == 1) {
    // if odd - pair last element with itself
    next_nodes.push(next_nodes[next_nodes.length - 1])
  }

  return await build_tree_recursively(next_nodes)
}

async function build_tree(leaves: Node[]) {
  const root = await build_tree_recursively(leaves)
  if (!root) {
    throw new Error('Failed building the tree')
  }

  return root
}

export function hash(a: string, b: string) {
  if (toBigInt(a) < toBigInt(b)) {
    return pedersen_from_hex(a, b)
  }
  return pedersen_from_hex(b, a)
}
