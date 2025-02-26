const express = require('express')
const ethers = require('ethers')
const hre = require("hardhat");
const viem = require('viem')
const {ABI} = require('./abi')
const app = express()
const port = 3000

// access cross origin
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});

const paymasterAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
const entryPointAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const counterAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const accountFactoryAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const ownerSignerAddress = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const ethersProvider = new ethers.JsonRpcProvider("http://localhost:8545");

const ownerWallet = new ethers.Wallet(ownerSignerAddress, ethersProvider);

const AccountFactory = new ethers.Contract(
  accountFactoryAddress,
  ABI.accountFactory,
  ethersProvider
);

const EntryPoint = new ethers.Contract(
  entryPointAddress,
  ABI.entryPoint,
  ownerWallet
)

app.get('/createAccount/:accountNonce', async (req, res) => {

  const factoryNonce = await AccountFactory.getFactoryNonce();
  const signature = await ownerWallet.signMessage(viem.toBytes(factoryNonce, req.params.accountNonce));

  const accountNonce = req.params.accountNonce;

  const _contractOwnerAddress = await ownerWallet.getAddress();
  const initCode =
    accountFactoryAddress +
    AccountFactory.interface
      .encodeFunctionData("createAccount", [accountNonce, _contractOwnerAddress, signature])
      .slice(2);

  const senderContract = await hre.ethers.getCreateAddress({
    from: accountFactoryAddress,
    nonce: accountNonce,
  })

  let userOpNonce = await EntryPoint.getNonce(senderContract, 0);

  const userOperation = {
    sender: senderContract,
    nonce: userOpNonce,
    initCode,
    callData: "0x",
    callGasLimit: 100_000,
    verificationGasLimit: 800_000,
    preVerificationGas: 50_000,
    maxFeePerGas: hre.ethers.parseUnits("50", "gwei"),
    maxPriorityFeePerGas: hre.ethers.parseUnits("0", "gwei"),
    paymasterAndData: paymasterAddress || "0x",
    signature: "0x",
  };

  console.log("User Operation: ", userOperation);

  const tx = await EntryPoint.handleOps([userOperation], _contractOwnerAddress);
  const receipt = await tx.wait();
  console.log(receipt);
  
  res.send('Ok!');
})

app.get('/counter/:walletNonce', async (req, res) => {

  const accountNonce = req.params.walletNonce;
  
  const senderContract = await hre.ethers.getCreateAddress({
    from: accountFactoryAddress,
    nonce: accountNonce,
  })

  const contractAddress = await AccountFactory.getAccountFromNonce(accountNonce);
  const deployedAccount = new ethers.Contract(
    contractAddress,
    ABI.accountFactory,
    ethersProvider
  );

  const txNonce = await deployedAccount.getMessage();
  const signature = await ownerOfAccount.signMessage(hre.ethers.getBytes(txNonce));

  const ownerSignerAddress = await ownerOfAccount.getAddress();

  /**
   * Essa constante se refere ao nosso contrato Account
   * Vamos usa-la para capturar nosso calldata que será executado
   * na criação da smart account.
   * Esse calldata poderia ser uma transferencia, um mint...
   */
  const Account = await hre.ethers.getContractFactory(ABI.Account);
  const Counter = await hre.ethers.getContractFactory(ABI.Counter);
  const userOpNonce = await EntryPoint.getNonce(senderContract, 0);

  const userOperation = {
    sender: senderContract,
    nonce: userOpNonce,
    initCode: "0x",
    callData: Account.interface.encodeFunctionData(
      "execute", 
      [
        counterAddress, 
        0, 
        Counter.interface.encodeFunctionData("iterate", []),
        signature
      ]),
    callGasLimit: 200_000,
    verificationGasLimit: 200_000,
    preVerificationGas: 50_000,
    maxFeePerGas: hre.ethers.parseUnits("10", "gwei"),
    maxPriorityFeePerGas: hre.ethers.parseUnits("5", "gwei"),
    paymasterAndData: paymasterAddress || "0x",
    signature: "0x",
  };

  const tx = await EntryPoint.handleOps([userOperation], ownerSignerAddress);
  const receipt = await tx.wait();

  const count = await Counter.attach(targetContract).count();
  console.log("Count: ", count);
  console.log("Receipt: ", receipt);
  
  res.send(receipt);
})

app.listen(port, () => {
  console.log(`App de exemplo esta rodando na porta ${port}`)
})