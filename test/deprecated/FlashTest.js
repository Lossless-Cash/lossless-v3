const { time, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { duration } = require('@openzeppelin/test-helpers/src/time');
const { ethers } = require('hardhat');

let initialHolder;
let recipient;
let anotherAccount;
let admin;
let adminBackup;
let lssAdmin;
let lssRecoveryAdmin;
let oneMoreAccount;
let pauseAdmin;
let deployer;
let losslessController;
let losslessControllerV1;
let token;
let dex;
let uniswapFactory;
let weth;
let uniRouter;
let flashswap;
const name = 'My Token';
const symbol = 'MTKN';

const supply = ethers.utils.parseEther('10000');
const initialBalance = ethers.utils.parseEther('10000');
const totalSupply = supply.add(initialBalance);

const { ZERO_ADDRESS } = constants;

// describe('Flash Test', () => {
//   beforeEach(async () => {
//     [
//       deployer,
//       initialHolder,
//       recipient,
//       anotherAccount,
//       admin,
//       lssAdmin,
//       lssRecoveryAdmin,
//       oneMoreAccount,
//       pauseAdmin,
//       adminBackup,
//       dex,
//     ] = await ethers.getSigners();

//     const LosslessController = await ethers.getContractFactory(
//       'LosslessControllerV1',
//     );

//     const LosslessControllerV3 = await ethers.getContractFactory(
//       'LosslessControllerV3',
//     );

//     losslessControllerV1 = await upgrades.deployProxy(
//       LosslessController,
//       [lssAdmin.address, lssRecoveryAdmin.address, pauseAdmin.address],
//       { initializer: 'initialize' },
//     );

//     losslessController = await upgrades.upgradeProxy(
//       losslessControllerV1.address,
//       LosslessControllerV3,
//       { initializer: 'initialize' },
//     );

//     const LERC20Mock = await ethers.getContractFactory('LERC20Mock');
//     token = await LERC20Mock.deploy(
//       supply,
//       name,
//       symbol,
//       initialHolder.address,
//       initialBalance,
//       losslessController.address,
//       admin.address,
//       adminBackup.address,
//       Number(time.duration.days(1)),
//     );

//     const UniswapV2Factory = await ethers.getContractFactory(
//       'UniswapV2Factory',
//     );
//     uniswapFactory = await UniswapV2Factory.attach(
//       '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
//     );

//     const UniswapV2Router02 = await ethers.getContractFactory(
//       'UniswapV2Router02',
//     );
//     uniRouter = await UniswapV2Router02.attach(
//       '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
//     );

//     const WETH9 = await ethers.getContractFactory('WETH9');
//     weth = await WETH9.attach('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');

//     const TestUniswapFlashSwap = await ethers.getContractFactory(
//       'TestUniswapFlashSwap',
//     );

//     flashswap = await TestUniswapFlashSwap.deploy();
//   });

//   describe('getVersion', () => {
//     it('should get version', async () => {
//       expect(
//         await losslessController.connect(oneMoreAccount).getVersion(),
//       ).to.be.equal(3);
//     });
//   });

//   describe.only('do', () => {
//     it('stuff', async () => {
//       //   console.log(
//       //     'balance',
//       //     Number(
//       //       (await initialHolder.getBalance()).div(
//       //         ethers.BigNumber.from('1000000000000000000'),
//       //       ),
//       //     ),
//       //   );

//       //   await initialHolder.sendTransaction({
//       //     to: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
//       //     value: ethers.BigNumber.from('5000000000000000000000'),
//       //   });

//       //   console.log(
//       //     'weth balance',
//       //     Number(
//       //       (await weth.balanceOf(initialHolder.address)).div(
//       //         ethers.BigNumber.from('1000000000000000000'),
//       //       ),
//       //     ),
//       //   );

//       //   let tx = await uniswapFactory
//       //     .connect(initialHolder)
//       //     .createPair(token.address, weth.address);

//       //   const res = await tx.wait();
//       //   const pairAddress = res.events[0].args[2];
//       //   console.log('pair created', pairAddress);

//       await token
//         .connect(initialHolder)
//         .approve(uniRouter.address, '100000000000000000000000');

//       await uniRouter
//         .connect(initialHolder)
//         .addLiquidityETH(
//           token.address,
//           ethers.utils.parseEther('1000'),
//           '0',
//           '0',
//           initialHolder.address,
//           1626413917,
//           { value: ethers.utils.parseEther('5000') },
//         );

//       await losslessController
//         .connect(lssAdmin)
//         .addToDexList('0xd5b7201603f6e608add93c90593bab1492914e20');

//       await token
//         .connect(initialHolder)
//         .transfer(flashswap.address, ethers.utils.parseEther('1'));

//       await losslessController
//         .connect(lssAdmin)
//         .addToWhitelist('0xd5b7201603f6e608add93c90593bab1492914e20');

//       let tx = await flashswap
//         .connect(initialHolder)
//         .testFlashSwap(token.address, ethers.utils.parseEther('10'));
//     });
//   });
// });
