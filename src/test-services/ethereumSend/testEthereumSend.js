const Web3 = require('web3')

const { HOME_RPC_URL, HOME_BRIDGE_ADDRESS, HOME_CHAIN_ID, HOME_PRIVATE_KEY, HOME_TOKEN_ADDRESS } = process.env

const abiToken = require('./IERC20').abi

const web3 = new Web3(HOME_RPC_URL, null, { transactionConfirmationBlocks: 1 })
const token = new web3.eth.Contract(abiToken, HOME_TOKEN_ADDRESS)

const amount = parseInt(process.argv[2])

const deployAddress = web3.eth.accounts.privateKeyToAccount(`0x${HOME_PRIVATE_KEY}`).address

async function main () {
  console.log(`Transfer from ${deployAddress} to ${HOME_BRIDGE_ADDRESS}, ${amount} tokens`)

  const query = token.methods.transfer(HOME_BRIDGE_ADDRESS, amount)
  const encodedABI = query.encodeABI()
  const tx = {
    data: encodedABI,
    from: deployAddress,
    to: HOME_TOKEN_ADDRESS,
    nonce: await web3.eth.getTransactionCount(deployAddress),
    chainId: parseInt(HOME_CHAIN_ID)
  }
  tx.gas = Math.min(Math.ceil(await query.estimateGas(tx) * 1.5), 6721975)
  const signedTx = await web3.eth.accounts.signTransaction(tx, HOME_PRIVATE_KEY)

  const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction)
  console.log(receipt.transactionHash)
}

main()
