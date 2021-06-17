import { Component, OnInit, NgModule } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import BigNumber from 'bignumber.js';
import { ContractService } from '../contract.service';
import { WalletService } from '../wallet.service';
import { ModalStakeLPComponent } from './modal-stake-lp/modal-stake-lp.component';
import { ConstantsService } from '../constants.service';
import { HelpersService } from '../helpers.service';
import { ModalUnstakeLPComponent } from './modal-unstake-lp/modal-unstake-lp.component';

@Component({
  selector: 'app-farming',
  templateUrl: './farming.component.html',
  styleUrls: ['./farming.component.css'],
})
export class FarmingComponent implements OnInit {
  PERIOD = 14; // 14 days
  BLOCK_TIME_IN_SEC = 14.256; // used for sushi APY

  // liquidity mining pool select options
  selectedPool: string = 'Uniswap v2';
  liquidityPools: Array<string> = ['Uniswap v2', 'SushiSwap', 'Bancor'];
  bancorSelectedToken: string = 'MPH';
  bancorTokens: Array<string> = ['MPH', 'BNT'];
  stakeAmount: BigNumber;

  unstakedMPHBalance: BigNumber;
  stakedMPHBalance: BigNumber;
  stakedMPHPoolProportion: BigNumber;
  claimableRewards: BigNumber;
  rewardPerDay: BigNumber;
  totalRewardPerSecond: BigNumber;
  rewardPerMPHPerSecond: BigNumber;
  totalStakedMPHBalance: BigNumber;
  mphPriceUSD: BigNumber;
  mphLPPriceUSD: BigNumber;
  yearlyROI: BigNumber;
  monthlyROI: BigNumber;
  weeklyROI: BigNumber;
  dailyROI: BigNumber;
  rewardStartTime: string;
  rewardEndTime: string;

  sushiUnstakedLPBalance: BigNumber;
  sushiStakedLPBalance: BigNumber;
  sushiStakedLPPoolProportion: BigNumber;
  sushiClaimableRewards: BigNumber;
  sushiRewardPerDay: BigNumber;
  sushiTotalRewardPerSecond: BigNumber;
  sushiRewardPerLPPerSecond: BigNumber;
  sushiTotalStakedLPBalance: BigNumber;
  sushiPriceUSD: BigNumber;
  sushiLPPriceUSD: BigNumber;
  sushiYearlyROI: BigNumber;
  sushiMonthlyROI: BigNumber;
  sushiWeeklyROI: BigNumber;
  sushiDailyROI: BigNumber;

  bancorUnstakedMPHBalance: BigNumber;
  bancorUnstakedBNTBalance: BigNumber;
  bancorStakedMPHBalance: BigNumber;
  bancorStakedBNTBalance: BigNumber;
  bancorTotalStakedMPH: BigNumber;
  bancorTotalStakedBNT: BigNumber;
  bancorClaimableRewards: BigNumber;
  bancorTotalRewardPerSecond: BigNumber;
  bancorRewardPerMPHPerSecond: BigNumber;
  bancorRewardPerBNTPerSecond: BigNumber;
  bancorStakedMPHPoolProportion: BigNumber;
  bancorStakedBNTPoolProportion: BigNumber;
  bancorTotalRewardPerDay: BigNumber;
  bancorMPHRewardPerDay: BigNumber;
  bancorBNTRewardPerDay: BigNumber;
  bancorMPHYearlyROI: BigNumber;
  bancorBNTYearlyROI: BigNumber;
  bntPriceUSD: BigNumber;
  bancorDepositIDs: Array<string>;
  bancorMPHDeposits: Array<number>;
  bancorBNTDeposits: Array<number>;

  constructor(
    private modalService: NgbModal,
    public wallet: WalletService,
    public contract: ContractService,
    public constants: ConstantsService,
    public helpers: HelpersService
  ) {
    this.resetData(true, true);
  }

  ngOnInit(): void {
    this.loadData(this.wallet.connected || this.wallet.watching, true);
    this.wallet.connectedEvent.subscribe(() => {
      this.resetData(true, true);
      this.loadData(true, true);
    });
    this.wallet.disconnectedEvent.subscribe(() => {
      this.resetData(true, false);
    });
    this.wallet.chainChangedEvent.subscribe((networkID) => {
      this.resetData(true, true);
      this.loadData(true, true);
    });
    this.wallet.accountChangedEvent.subscribe((account) => {
      this.resetData(true, false);
      this.loadData(true, false);
    });
  }

  async loadData(loadUser: boolean, loadGlobal: boolean) {
    const readonlyWeb3 = this.wallet.readonlyWeb3();
    const rewards = this.contract.getNamedContract('Farming', readonlyWeb3);
    const uniLPToken = this.contract.getNamedContract('MPHLP', readonlyWeb3);

    const sushiMasterChef = this.contract.getContract(
      this.constants.SUSHI_MASTERCHEF,
      'MasterChef',
      readonlyWeb3
    );
    const bancorLiquidityProtectionStats = this.contract.getContract(
      this.constants.BANCOR_LP_STATS,
      'LiquidityProtectionStats',
      readonlyWeb3
    );
    const bancorLPStore = this.contract.getNamedContract(
      'BancorLPStore',
      readonlyWeb3
    );
    const bancorStaking = this.contract.getContract(
      this.constants.BANCOR_STAKING_REWARDS,
      'BancorStaking',
      readonlyWeb3
    );
    const bancorStakingStore = this.contract.getContract(
      this.constants.BANCOR_STAKING_REWARDS_STORE,
      'BancorStakingStore',
      readonlyWeb3
    );

    if (loadGlobal) {
      this.totalStakedMPHBalance = new BigNumber(
        await rewards.methods.totalSupply().call()
      ).div(this.constants.PRECISION);
      this.totalRewardPerSecond = new BigNumber(
        await rewards.methods.rewardRate().call()
      ).div(this.constants.PRECISION);
      this.rewardPerMPHPerSecond = this.totalRewardPerSecond.div(
        this.totalStakedMPHBalance
      );
      if (this.totalStakedMPHBalance.isZero()) {
        this.rewardPerMPHPerSecond = new BigNumber(0);
      }
      // load reward start & end time
      rewards.methods
        .periodFinish()
        .call()
        .then((endTime) => {
          this.rewardStartTime = new Date(
            (+endTime - this.PERIOD * 24 * 60 * 60) * 1e3
          ).toLocaleString();
          this.rewardEndTime = new Date(+endTime * 1e3).toLocaleString();
        });

      this.mphPriceUSD = await this.helpers.getMPHPriceUSD();
      this.mphLPPriceUSD = await this.helpers.getMPHLPPriceUSD();
      const secondROI = this.totalRewardPerSecond
        .times(this.mphPriceUSD)
        .div(this.totalStakedMPHBalance.times(this.mphLPPriceUSD))
        .times(100);
      this.yearlyROI = secondROI.times(this.constants.YEAR_IN_SEC);
      this.monthlyROI = secondROI.times(this.constants.MONTH_IN_SEC);
      this.weeklyROI = secondROI.times(this.constants.WEEK_IN_SEC);
      this.dailyROI = secondROI.times(this.constants.DAY_IN_SEC);

      // sushi
      let sushiLPToken = this.contract.getERC20(
        this.constants.SUSHI_LP,
        readonlyWeb3
      );
      const sushiPoolInfo = await sushiMasterChef.methods
        .poolInfo(this.constants.SUSHI_MPH_ONSEN_ID)
        .call();
      this.sushiTotalStakedLPBalance = new BigNumber(
        await sushiLPToken.methods
          .balanceOf(this.constants.SUSHI_MASTERCHEF)
          .call()
      ).div(this.constants.PRECISION);
      this.sushiTotalRewardPerSecond = new BigNumber(
        await sushiMasterChef.methods.sushiPerBlock().call()
      )
        .div(this.BLOCK_TIME_IN_SEC)
        .div(this.constants.PRECISION)
        .times(sushiPoolInfo.allocPoint)
        .div(await sushiMasterChef.methods.totalAllocPoint().call());
      this.sushiRewardPerLPPerSecond = this.sushiTotalRewardPerSecond.div(
        this.sushiTotalStakedLPBalance
      );
      if (this.sushiTotalStakedLPBalance.isZero()) {
        this.sushiRewardPerLPPerSecond = new BigNumber(0);
      }
      this.sushiPriceUSD = new BigNumber(
        await this.helpers.getTokenPriceUSD(this.constants.SUSHI)
      );
      this.sushiLPPriceUSD = await this.helpers.getLPPriceUSD(
        this.constants.SUSHI_LP
      );
      const sushiSecondROI = this.sushiTotalRewardPerSecond
        .times(this.sushiPriceUSD)
        .div(this.sushiTotalStakedLPBalance.times(this.sushiLPPriceUSD))
        .times(100);
      this.sushiYearlyROI = sushiSecondROI.times(this.constants.YEAR_IN_SEC);
      this.sushiMonthlyROI = sushiSecondROI.times(this.constants.MONTH_IN_SEC);
      this.sushiWeeklyROI = sushiSecondROI.times(this.constants.WEEK_IN_SEC);
      this.sushiDailyROI = sushiSecondROI.times(this.constants.DAY_IN_SEC);

      // bancor
      this.bancorTotalStakedMPH = new BigNumber(
        await bancorLiquidityProtectionStats.methods
          .totalReserveAmount(
            this.constants.BANCOR_MPHBNT_POOL,
            this.constants.MPH_ADDRESS[this.constants.CHAIN_ID.MAINNET]
          )
          .call()
      ).div(this.constants.PRECISION);
      this.bancorTotalStakedBNT = new BigNumber(
        await bancorLiquidityProtectionStats.methods
          .totalReserveAmount(
            this.constants.BANCOR_MPHBNT_POOL,
            this.constants.BNT
          )
          .call()
      ).div(this.constants.PRECISION);
      let poolProgram: [number, number, number, string[], number[]] =
        await bancorStakingStore.methods
          .poolProgram(this.constants.BANCOR_MPHBNT_POOL)
          .call();
      this.bancorTotalRewardPerSecond = new BigNumber(poolProgram[2]);
      if (
        poolProgram[3][0].toLowerCase() ===
        this.constants.MPH_ADDRESS[this.constants.CHAIN_ID.MAINNET]
      ) {
        this.bancorRewardPerMPHPerSecond = new BigNumber(
          (poolProgram[2] * poolProgram[4][0]) / 1e6 / this.constants.PRECISION
        );
        this.bancorRewardPerBNTPerSecond = new BigNumber(
          (poolProgram[2] * poolProgram[4][1]) / 1e6 / this.constants.PRECISION
        );
      } else {
        this.bancorRewardPerMPHPerSecond = new BigNumber(
          (poolProgram[2] * poolProgram[4][1]) / 1e6 / this.constants.PRECISION
        );
        this.bancorRewardPerBNTPerSecond = new BigNumber(
          (poolProgram[2] * poolProgram[4][0]) / 1e6 / this.constants.PRECISION
        );
      }
      this.bntPriceUSD = new BigNumber(
        await this.helpers.getTokenPriceUSD(this.constants.BNT)
      );
      const bancorMPHSecondROI = this.bancorRewardPerMPHPerSecond
        .times(this.bntPriceUSD)
        .div(this.bancorTotalStakedMPH.times(this.mphPriceUSD))
        .times(100)
        .times(2); // based on 2x multiplier
      this.bancorMPHYearlyROI = bancorMPHSecondROI.times(
        this.constants.YEAR_IN_SEC
      );
      const bancorBNTSecondROI = this.bancorRewardPerBNTPerSecond
        .times(this.bntPriceUSD)
        .div(this.bancorTotalStakedBNT.times(this.bntPriceUSD))
        .times(100)
        .times(2); // based on 2x multiplier
      this.bancorBNTYearlyROI = bancorBNTSecondROI.times(
        this.constants.YEAR_IN_SEC
      );
    }

    let address;
    if (!this.wallet.watching) {
      address = this.wallet.userAddress;
    } else {
      address = this.wallet.watchedAddress;
    }

    if (loadUser) {
      this.unstakedMPHBalance = new BigNumber(
        await uniLPToken.methods.balanceOf(address).call()
      ).div(this.constants.PRECISION);
      this.stakedMPHBalance = new BigNumber(
        await rewards.methods.balanceOf(address).call()
      ).div(this.constants.PRECISION);
      this.claimableRewards = new BigNumber(
        await rewards.methods.earned(address).call()
      ).div(this.constants.PRECISION);
      this.stakedMPHPoolProportion = this.stakedMPHBalance
        .div(this.totalStakedMPHBalance)
        .times(100);
      if (this.totalStakedMPHBalance.isZero()) {
        this.stakedMPHPoolProportion = new BigNumber(0);
      }
      this.rewardPerDay = this.stakedMPHBalance
        .times(this.rewardPerMPHPerSecond)
        .times(this.constants.DAY_IN_SEC);

      // sushi
      let sushiLPToken = this.contract.getERC20(
        this.constants.SUSHI_LP,
        readonlyWeb3
      );
      this.sushiUnstakedLPBalance = new BigNumber(
        await sushiLPToken.methods.balanceOf(address).call()
      ).div(this.constants.PRECISION);

      let sushiUserInfo;
      await Promise.all([
        (sushiUserInfo = await sushiMasterChef.methods
          .userInfo(this.constants.SUSHI_MPH_ONSEN_ID, address)
          .call()),
        (this.sushiClaimableRewards = new BigNumber(
          await sushiMasterChef.methods
            .pendingSushi(this.constants.SUSHI_MPH_ONSEN_ID, address)
            .call()
        ).div(this.constants.PRECISION)),
      ]);
      this.sushiStakedLPBalance = new BigNumber(sushiUserInfo.amount).div(
        this.constants.PRECISION
      );
      this.sushiStakedLPPoolProportion = this.sushiStakedLPBalance
        .div(this.sushiTotalStakedLPBalance)
        .times(100);
      if (this.sushiTotalStakedLPBalance.isZero()) {
        this.sushiStakedLPPoolProportion = new BigNumber(0);
      }
      this.sushiRewardPerDay = this.sushiStakedLPBalance
        .times(this.sushiRewardPerLPPerSecond)
        .times(this.constants.DAY_IN_SEC);

      // bancor
      let mph = this.contract.getERC20(
        this.constants.MPH_ADDRESS[this.constants.CHAIN_ID.MAINNET],
        readonlyWeb3
      );
      let bnt = this.contract.getERC20(this.constants.BNT, readonlyWeb3);
      this.bancorUnstakedMPHBalance = new BigNumber(
        await mph.methods.balanceOf(address).call()
      ).div(this.constants.PRECISION);
      this.bancorUnstakedBNTBalance = new BigNumber(
        await bnt.methods.balanceOf(address).call()
      ).div(this.constants.PRECISION);
      this.bancorStakedMPHBalance = new BigNumber(
        await bancorLiquidityProtectionStats.methods
          .totalProviderAmount(
            address,
            this.constants.BANCOR_MPHBNT_POOL,
            this.constants.MPH_ADDRESS[this.constants.CHAIN_ID.MAINNET]
          )
          .call()
      ).div(this.constants.PRECISION);
      this.bancorStakedBNTBalance = new BigNumber(
        await bancorLiquidityProtectionStats.methods
          .totalProviderAmount(
            address,
            this.constants.BANCOR_MPHBNT_POOL,
            this.constants.BNT
          )
          .call()
      ).div(this.constants.PRECISION);
      this.bancorClaimableRewards = new BigNumber(
        await bancorStaking.methods
          .pendingPoolRewards(address, this.constants.BANCOR_MPHBNT_POOL)
          .call()
      ).div(this.constants.PRECISION);
      this.bancorStakedMPHPoolProportion = this.bancorStakedMPHBalance
        .div(this.bancorTotalStakedMPH)
        .times(100);
      this.bancorStakedBNTPoolProportion = this.bancorStakedBNTBalance
        .div(this.bancorTotalStakedBNT)
        .times(100);
      this.bancorMPHRewardPerDay = this.bancorRewardPerMPHPerSecond
        .times(this.constants.DAY_IN_SEC)
        .times(this.bancorStakedMPHBalance)
        .div(this.bancorTotalStakedMPH);
      this.bancorBNTRewardPerDay = this.bancorRewardPerBNTPerSecond
        .times(this.constants.DAY_IN_SEC)
        .times(this.bancorStakedBNTBalance)
        .div(this.bancorTotalStakedBNT);
      this.bancorTotalRewardPerDay = this.bancorMPHRewardPerDay.plus(
        this.bancorBNTRewardPerDay
      );
      this.bancorDepositIDs = await bancorLPStore.methods
        .protectedLiquidityIds(address)
        .call();

      let deposit;
      for (let id in this.bancorDepositIDs) {
        deposit = await bancorLPStore.methods
          .protectedLiquidity(this.bancorDepositIDs[id])
          .call();
        if (
          deposit[1].toLowerCase() ===
          this.constants.BANCOR_MPHBNT_POOL.toLowerCase()
        ) {
          if (
            deposit[2].toLowerCase() ===
            this.constants.MPH_ADDRESS[
              this.constants.CHAIN_ID.MAINNET
            ].toLowerCase()
          ) {
            this.bancorMPHDeposits.push(parseInt(this.bancorDepositIDs[id]));
          } else if (
            deposit[2].toLowerCase() === this.constants.BNT.toLowerCase()
          ) {
            this.bancorBNTDeposits.push(parseInt(this.bancorDepositIDs[id]));
          }
        }
      }
    }
  }

  resetData(resetUser: boolean, resetGlobal: boolean): void {
    if (resetUser) {
      this.unstakedMPHBalance = new BigNumber(0);
      this.stakedMPHBalance = new BigNumber(0);
      this.stakedMPHPoolProportion = new BigNumber(0);
      this.claimableRewards = new BigNumber(0);
      this.rewardPerDay = new BigNumber(0);

      this.sushiUnstakedLPBalance = new BigNumber(0);
      this.sushiStakedLPBalance = new BigNumber(0);
      this.sushiStakedLPPoolProportion = new BigNumber(0);
      this.sushiClaimableRewards = new BigNumber(0);
      this.sushiRewardPerDay = new BigNumber(0);

      this.bancorUnstakedMPHBalance = new BigNumber(0);
      this.bancorUnstakedBNTBalance = new BigNumber(0);
      this.bancorStakedMPHBalance = new BigNumber(0);
      this.bancorStakedBNTBalance = new BigNumber(0);
      this.bancorClaimableRewards = new BigNumber(0);
      this.bancorStakedMPHPoolProportion = new BigNumber(0);
      this.bancorStakedBNTPoolProportion = new BigNumber(0);
      this.bancorTotalRewardPerDay = new BigNumber(0);
      this.bancorMPHRewardPerDay = new BigNumber(0);
      this.bancorBNTRewardPerDay = new BigNumber(0);
    }

    if (resetGlobal) {
      this.stakeAmount = new BigNumber(0);

      this.totalStakedMPHBalance = new BigNumber(0);
      this.rewardPerMPHPerSecond = new BigNumber(0);
      this.totalRewardPerSecond = new BigNumber(0);
      this.mphPriceUSD = new BigNumber(0);
      this.mphLPPriceUSD = new BigNumber(0);
      this.yearlyROI = new BigNumber(0);
      this.monthlyROI = new BigNumber(0);
      this.weeklyROI = new BigNumber(0);
      this.dailyROI = new BigNumber(0);

      this.sushiTotalStakedLPBalance = new BigNumber(0);
      this.sushiRewardPerLPPerSecond = new BigNumber(0);
      this.sushiTotalRewardPerSecond = new BigNumber(0);
      this.sushiPriceUSD = new BigNumber(0);
      this.sushiLPPriceUSD = new BigNumber(0);
      this.sushiYearlyROI = new BigNumber(0);
      this.sushiMonthlyROI = new BigNumber(0);
      this.sushiWeeklyROI = new BigNumber(0);
      this.sushiDailyROI = new BigNumber(0);

      this.bntPriceUSD = new BigNumber(0);
      this.bancorTotalRewardPerSecond = new BigNumber(0);
      this.bancorRewardPerMPHPerSecond = new BigNumber(0);
      this.bancorRewardPerBNTPerSecond = new BigNumber(0);
      this.bancorTotalStakedMPH = new BigNumber(0);
      this.bancorTotalStakedBNT = new BigNumber(0);
      this.bancorMPHYearlyROI = new BigNumber(0);
      this.bancorBNTYearlyROI = new BigNumber(0);
      this.bancorDepositIDs = [];
      this.bancorMPHDeposits = [];
      this.bancorBNTDeposits = [];
    }
  }

  openStakeModal() {
    const modalRef = this.modalService.open(ModalStakeLPComponent, {
      windowClass: 'fullscreen',
    });
    modalRef.componentInstance.selectedPool = this.selectedPool;

    //uni v2
    modalRef.componentInstance.stakedMPHPoolProportion =
      this.stakedMPHPoolProportion;
    modalRef.componentInstance.stakedMPHBalance = this.stakedMPHBalance;
    modalRef.componentInstance.totalStakedMPHBalance =
      this.totalStakedMPHBalance;
    modalRef.componentInstance.totalRewardPerSecond = this.totalRewardPerSecond;
    modalRef.componentInstance.rewardPerDay = this.rewardPerDay;
    modalRef.componentInstance.mphPriceUSD = this.mphPriceUSD;
  }

  openUnstakeModal() {
    const modalRef = this.modalService.open(ModalUnstakeLPComponent, {
      windowClass: 'fullscreen',
    });
    modalRef.componentInstance.selectedPool = this.selectedPool;
    modalRef.componentInstance.bancorSelectedToken = this.bancorSelectedToken;
    modalRef.componentInstance.bancorTokens = this.bancorTokens;

    modalRef.componentInstance.stakedMPHPoolProportion =
      this.stakedMPHPoolProportion;
    modalRef.componentInstance.stakedMPHBalance = this.stakedMPHBalance;
    modalRef.componentInstance.totalStakedMPHBalance =
      this.totalStakedMPHBalance;
    modalRef.componentInstance.totalRewardPerSecond = this.totalRewardPerSecond;
    modalRef.componentInstance.rewardPerDay = this.rewardPerDay;
    modalRef.componentInstance.mphPriceUSD = this.mphPriceUSD;

    modalRef.componentInstance.sushiStakedLPBalance = this.sushiStakedLPBalance;
    modalRef.componentInstance.bancorStakedMPHBalance =
      this.bancorStakedMPHBalance;
    modalRef.componentInstance.bancorStakedBNTBalance =
      this.bancorStakedBNTBalance;
    modalRef.componentInstance.bancorMPHDeposits = this.bancorMPHDeposits;
    modalRef.componentInstance.bancorBNTDeposits = this.bancorBNTDeposits;
  }

  setStakeAmount(amount: number | string) {
    this.stakeAmount = new BigNumber(amount);
    if (this.stakeAmount.isNaN()) {
      this.stakeAmount = new BigNumber(0);
    }
  }

  unstakeAndClaim() {
    const rewards = this.contract.getNamedContract('Farming');
    const func = rewards.methods.exit();

    this.wallet.sendTx(
      func,
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  stake() {
    let rewards;
    let lpToken;
    let func;
    const stakeAmount = this.helpers.processWeb3Number(
      this.stakeAmount.times(this.constants.PRECISION)
    );

    if (this.selectedPool === 'Uniswap v2') {
      rewards = this.contract.getNamedContract('Farming');
      lpToken = this.contract.getNamedContract('MPHLP');
      func = rewards.methods.stake(stakeAmount);
    } else if (this.selectedPool === 'SushiSwap') {
      rewards = this.contract.getNamedContract('MasterChef');
      lpToken = this.contract.getNamedContract('SushiLP');
      func = rewards.methods.deposit(
        this.constants.SUSHI_MPH_ONSEN_ID,
        stakeAmount
      );
    } else if (this.selectedPool === 'Bancor') {
      rewards = this.contract.getNamedContract('BancorLP');
      if (this.bancorSelectedToken === 'MPH') {
        lpToken = this.contract.getNamedContract('MPHToken');
        func = rewards.methods.addLiquidity(
          this.constants.BANCOR_MPHBNT_POOL,
          this.constants.MPH_ADDRESS[this.constants.CHAIN_ID.MAINNET],
          stakeAmount
        );
      } else if (this.bancorSelectedToken === 'BNT') {
        lpToken = this.contract.getNamedContract('BNTToken');
        func = rewards.methods.addLiquidity(
          this.constants.BANCOR_MPHBNT_POOL,
          this.constants.BNT,
          stakeAmount
        );
      }
    }

    this.wallet.sendTxWithToken(
      func,
      lpToken,
      rewards.options.address,
      stakeAmount,
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  claim() {
    let rewards;
    let func;

    if (this.selectedPool === 'Uniswap v2') {
      rewards = this.contract.getNamedContract('Farming');
      func = rewards.methods.getReward();
    } else if (this.selectedPool === 'SushiSwap') {
      rewards = this.contract.getNamedContract('MasterChef');
      func = rewards.methods.deposit(this.constants.SUSHI_MPH_ONSEN_ID, 0);
    } else if (this.selectedPool === 'Bancor') {
      rewards = this.contract.getNamedContract('BancorStaking');
      func = rewards.methods.claimRewards();
    }

    this.wallet.sendTx(
      func,
      () => {},
      () => {},
      (error) => {
        this.wallet.displayGenericError(error);
      }
    );
  }

  canStake() {
    if (this.selectedPool === 'Uniswap v2') {
      return (
        this.stakeAmount <= this.unstakedMPHBalance && this.stakeAmount.gt(0)
      );
    } else if (this.selectedPool === 'SushiSwap') {
      return (
        this.stakeAmount <= this.sushiUnstakedLPBalance &&
        this.stakeAmount.gt(0)
      );
    } else if (this.selectedPool === 'Bancor') {
      if (this.bancorSelectedToken === 'MPH') {
        return (
          this.stakeAmount <= this.bancorUnstakedMPHBalance &&
          this.stakeAmount.gt(0)
        );
      } else if (this.bancorSelectedToken === 'BNT') {
        return (
          this.stakeAmount <= this.bancorUnstakedBNTBalance &&
          this.stakeAmount.gt(0)
        );
      }
    }
  }

  canUnstake() {
    if (this.selectedPool === 'Uniswap v2') {
      return this.stakedMPHBalance.gt(0);
    } else if (this.selectedPool === 'SushiSwap') {
      return this.sushiStakedLPBalance.gt(0);
    } else if (this.selectedPool === 'Bancor') {
      if (this.bancorSelectedToken === 'MPH') {
        return this.bancorStakedMPHBalance.gt(0);
      } else if (this.bancorSelectedToken === 'BNT') {
        return this.bancorStakedBNTBalance.gt(0);
      }
    }
  }

  canClaim() {
    if (this.selectedPool === 'Uniswap v2') {
      return this.claimableRewards.gt(0);
    } else if (this.selectedPool === 'SushiSwap') {
      return this.sushiClaimableRewards.gt(0);
    } else if (this.selectedPool === 'Bancor') {
      return this.bancorClaimableRewards.gt(0);
    }
  }

  canContinue() {
    return this.wallet.connected;
  }
}
