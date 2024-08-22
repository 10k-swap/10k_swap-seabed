import { RoundTreeData } from '../../typings'
import { read_allocations } from './processor'

let ROUND_DATA: RoundTreeData[] = []

export async function get_all_data() {
  return ROUND_DATA
}

export async function update_api_data() {
  ROUND_DATA = await read_allocations('../defispring/raw_input')
}
