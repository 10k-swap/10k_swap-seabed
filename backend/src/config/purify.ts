export default {
  accountAddressRpcs: (process.env['PURIFY_ACCOUNT_ADDRESS_RPCS'] || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item != ''),
}
