"use client";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import Header from "@/components/Header";
import EnhancedStatCard from "@/components/dashboard/EnhancedStatCard";
import TabNavigation from "@/components/dashboard/TabNavigation";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import BetCard from "@/components/dashboard/BetCard";
import AchievementCard from "@/components/dashboard/AchievementCard";
import EmptyState from "@/components/dashboard/EmptyState";
import ProgressRing from "@/components/dashboard/ProgressRing";
import QuickActions from "@/components/dashboard/QuickActions";
import NotificationAlert from "@/components/dashboard/NotificationAlert";
import BetHistoryFilters, { type BetStatusFilter, type BetSortOption } from "@/components/dashboard/BetHistoryFilters";
import { Target, Trophy, DollarSign, Wallet, TrendingUp, Award, Sparkles, Activity, AlertTriangle, RefreshCw, Zap, Clock } from "lucide-react";
import type { DashboardTab, RecentActivity } from "./types";
import { PrizePredictionContract } from "../../app/ABIs/index";
import PrizePoolPredictionABI from "../../app/ABIs/Prediction.json";
import { exportBetsToCSV } from "./exportUtils";

interface UserStats {
  totalPredictions: number;
  correctPredictions: number;
  currentStreak: number;
  longestStreak: number;
  totalWinnings: string;
  accuracyPercentage: number;
  hasStreakSaver: boolean;
  totalPoints: number;
  walletBalance: string;
}

interface ActiveBet {
  id: string;
  question: string;
  selectedOption: string;
  optionIndex: number;
  entryFee: string;
  timestamp: Date;
  endTime: Date;
  status: "active" | "closed" | "won" | "lost" | "pending_resolution"; // Update status type
  prizeAmount?: string;
  claimed?: boolean;
  totalParticipants: number;
}

// Interface baru untuk market yang perlu di-resolve/claim
interface MarketToResolve {
  id: string;
  question: string;
  options: string[];
  totalParticipants: number;
  prizePool: string;
  endTime: Date;
  resolutionTime: Date; 
  isEmergency: boolean; 
  userRole: "creator" | "participant"; 
}

export default function DashboardPage() {
  const [selectedTab, setSelectedTab] = useState<DashboardTab>("Active Bets");
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [activeBets, setActiveBets] = useState<ActiveBet[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userAddress, setUserAddress] = useState("");
  
  // State baru untuk Market Action
  const [marketsToResolve, setMarketsToResolve] = useState<MarketToResolve[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BetStatusFilter>("all");
  const [sortOption, setSortOption] = useState<BetSortOption>("newest");

  useEffect(() => {
    connectAndFetchData();
  }, []);

  const connectAndFetchData = async () => {
    try {
      setLoading(true);
      setError("");

      if (typeof window.ethereum === "undefined") {
        setError("Please install MetaMask to view your dashboard");
        setLoading(false);
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const accounts = await provider.send("eth_requestAccounts", []);
      const address = accounts[0];
      setUserAddress(address);

      const contract = new ethers.Contract(
        PrizePredictionContract.address,
        PrizePoolPredictionABI.abi,
        provider
      );

      // 1. Fetch User Stats
      const stats = await contract.getUserStats(address);
      const balance = await provider.getBalance(address);

      setUserStats({
        totalPredictions: Number(stats.totalPredictions),
        correctPredictions: Number(stats.correctPredictions),
        currentStreak: Number(stats.currentStreak),
        longestStreak: Number(stats.longestStreak),
        totalWinnings: ethers.formatEther(stats.totalWinnings),
        accuracyPercentage: Number(stats.accuracyPercentage) / 100,
        hasStreakSaver: stats.hasStreakSaver,
        totalPoints: Number(stats.totalPoints),
        walletBalance: ethers.formatEther(balance),
      });

      // 2. LOGIKA PENTING: Cari Market Macet / Butuh Resolve
      const predictionCounter = await contract.predictionCounter();
      const totalPredictions = Number(predictionCounter);
      const marketsNeedResolution: MarketToResolve[] = [];
      const now = new Date();

      // Ambil daftar prediksi yang diikuti user
      const userParticipatedIds = await contract.getUserParticipatedPredictions(address);
      const participatedSet = new Set(userParticipatedIds.map((id: bigint) => Number(id)));

      // Loop 50 market terakhir untuk efisiensi
      const startLoop = totalPredictions; 
      const endLoop = Math.max(1, totalPredictions - 50); 

      for (let i = startLoop; i >= endLoop; i--) {
        try {
          const pred = await contract.getPrediction(i);
          
          const isCreator = pred.creator.toLowerCase() === address.toLowerCase();
          const isParticipant = participatedSet.has(i);
          
          const endTime = new Date(Number(pred.endTime) * 1000);
          const resolutionTime = new Date(Number(pred.resolutionTime) * 1000);
          
          const isEnded = now > endTime;
          const isResolved = pred.resolved;
          
          // Emergency Time = ResolutionTime + 7 Hari (Sesuai Smart Contract)
          const emergencyThreshold = new Date(resolutionTime.getTime() + (7 * 24 * 60 * 60 * 1000));
          const isEmergencyTime = now > emergencyThreshold;

          // Kondisi: Market sudah selesai waktunya, TAPI belum di-resolve (Uang tertahan)
          if (isEnded && !isResolved && pred.active) {
             
             // KASUS A: Saya Creator -> Wajib resolve normal
             if (isCreator) {
                marketsNeedResolution.push({
                  id: pred.id.toString(),
                  question: pred.question,
                  options: [...pred.options],
                  totalParticipants: Number(pred.totalParticipants),
                  prizePool: ethers.formatEther(pred.prizePool),
                  endTime: endTime,
                  resolutionTime: resolutionTime,
                  isEmergency: isEmergencyTime, 
                  userRole: "creator"
                });
             } 
             // KASUS B: Saya Peserta -> Cek apakah Creator kabur (Emergency Mode)
             else if (isParticipant) {
                marketsNeedResolution.push({
                  id: pred.id.toString(),
                  question: pred.question,
                  options: [...pred.options],
                  totalParticipants: Number(pred.totalParticipants),
                  prizePool: ethers.formatEther(pred.prizePool),
                  endTime: endTime,
                  resolutionTime: resolutionTime,
                  isEmergency: isEmergencyTime,
                  userRole: "participant"
                });
             }
          }
        } catch (err) {
          console.error(`Failed to fetch prediction ${i}`, err);
        }
      }
      setMarketsToResolve(marketsNeedResolution);

      // 3. Fetch Active Bets History
      const betsPromises = userParticipatedIds.map((id: bigint) =>
        fetchBetDetails(contract, Number(id), address)
      );
      const bets = await Promise.all(betsPromises);
      const validBets = bets.filter((bet): bet is ActiveBet => bet !== null);

      validBets.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setActiveBets(validBets);
      setActivities(generateActivities(validBets));

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchBetDetails = async (
    contract: ethers.Contract,
    predictionId: number,
    userAddress: string
  ): Promise<ActiveBet | null> => {
    try {
      const prediction = await contract.getPrediction(predictionId);
      const userPrediction = await contract.getUserPrediction(predictionId, userAddress);
      
      if (userPrediction.timestamp === BigInt(0)) return null;

      const prizeStatus = await contract.getUserPrizeStatus(predictionId, userAddress);
      const endTime = new Date(Number(prediction.endTime) * 1000);
      const now = new Date();
      
      let status: "active" | "closed" | "won" | "lost" | "pending_resolution";
      
      if (prediction.resolved) {
        status = prizeStatus.hasWon ? "won" : "lost";
      } else if (now > endTime) {
        // Jika waktu habis tapi belum resolve, statusnya pending
        status = "pending_resolution";
      } else {
        status = "active";
      }

      return {
        id: prediction.id.toString(),
        question: prediction.question,
        selectedOption: prediction.options[Number(userPrediction.option)],
        optionIndex: Number(userPrediction.option),
        entryFee: ethers.formatEther(prediction.entryFee),
        timestamp: new Date(Number(userPrediction.timestamp) * 1000),
        endTime,
        status,
        prizeAmount: prizeStatus.hasWon ? ethers.formatEther(prizeStatus.prizeAmount) : undefined,
        claimed: userPrediction.claimed,
        totalParticipants: Number(prediction.totalParticipants),
      };
    } catch (err) {
      console.error(`Error fetching bet ${predictionId}:`, err);
      return null;
    }
  };

  // --- LOGIKA TOMBOL RESOLVE / FORCE CLAIM ---
  const handleResolveMarket = async (market: MarketToResolve, optionIndex: number) => {
    try {
      if (!window.ethereum) return;
      
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        PrizePredictionContract.address,
        PrizePoolPredictionABI.abi,
        signer
      );

      setResolvingId(market.id);
      let tx;

      // Smart Logic: Otomatis pilih metode
      if (market.isEmergency) {
        // Jika sudah masuk waktu emergency (Creator telat > 7 hari) -> Siapapun bisa claim
        console.log("Executing Emergency Resolve...");
        tx = await contract.emergencyResolve(market.id, optionIndex);
      } else {
        // Jika masih waktu normal -> Hanya Creator
        console.log("Executing Standard Resolve...");
        tx = await contract.resolvePrediction(market.id, optionIndex);
      }
      
      await tx.wait();
      alert("Success! Market resolved and prizes automatically transferred to wallet.");
      
      connectAndFetchData(); // Refresh UI

    } catch (err: any) {
      console.error("Error resolving market:", err);
      let msg = err.reason || err.message || "Unknown error";
      if (msg.includes("Only creator")) msg = "Only the creator can resolve right now. Please wait for the Emergency Period.";
      if (msg.includes("Resolution period expired")) msg = "Normal resolution expired. Please use the Force Claim button.";
      
      alert(`Transaction Failed: ${msg}`);
    } finally {
      setResolvingId(null);
    }
  };

  // --- CLAIM ALL INTEGRATION ---
  const handleClaimAll = () => {
    const stuckMarkets = marketsToResolve.filter(m => m.isEmergency);
    if (stuckMarkets.length > 0) {
      const confirm = window.confirm(`Found ${stuckMarkets.length} markets eligible for Force Claim. Proceed to claim section?`);
      if (confirm) {
         const element = document.getElementById('action-required-section');
         if (element) element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      alert("No pending claims found. Prizes are distributed automatically upon resolution. If a market just ended, please wait for the creator.");
    }
  };

  // Helpers
  const generateActivities = (bets: ActiveBet[]): RecentActivity[] => {
    return bets.slice(0, 10).map((bet) => ({
      id: bet.id,
      type: bet.status === "won" ? "bet_won" : bet.status === "lost" ? "bet_lost" : "bet_placed",
      marketQuestion: bet.question,
      amount: parseFloat((bet.status === "won" && bet.prizeAmount) ? bet.prizeAmount : bet.entryFee),
      timestamp: bet.timestamp,
      position: bet.selectedOption as "Yes" | "No",
      currency: "STT",
    }));
  };

  const unclaimedPrizes = activeBets.filter(bet => bet.status === "won" && !bet.claimed).length;
  const closingSoonBets = activeBets.filter(bet => {
    if (bet.status !== "active") return false;
    const hoursUntilClose = (bet.endTime.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    return hoursUntilClose <= 24 && hoursUntilClose > 0;
  }).length;

  const getFilteredAndSortedBets = () => {
    let filtered = [...activeBets];
    if (statusFilter !== "all") {
        // Simple mapping for demo filters
        if (statusFilter === 'active') filtered = filtered.filter(b => b.status === 'active');
        else if (statusFilter === 'won') filtered = filtered.filter(b => b.status === 'won');
        else if (statusFilter === 'lost') filtered = filtered.filter(b => b.status === 'lost');
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(bet => 
        bet.question.toLowerCase().includes(query) || bet.selectedOption.toLowerCase().includes(query)
      );
    }
    
    filtered.sort((a, b) => {
      switch (sortOption) {
        case "newest": return b.timestamp.getTime() - a.timestamp.getTime();
        case "oldest": return a.timestamp.getTime() - b.timestamp.getTime();
        case "highest": return parseFloat(b.entryFee) - parseFloat(a.entryFee);
        case "lowest": return parseFloat(a.entryFee) - parseFloat(b.entryFee);
        default: return 0;
      }
    });
    return filtered;
  };

  const filteredBets = getFilteredAndSortedBets();
  // Filter active bets tab to show Active + Pending Resolution
  const activeBetsOnly = activeBets.filter(bet => bet.status === "active" || bet.status === "pending_resolution");
  const winRate = userStats && userStats.totalPredictions > 0
    ? (userStats.correctPredictions / userStats.totalPredictions) * 100
    : 0;

  const handleExport = () => {
    if (!userStats) return;
    exportBetsToCSV(
      activeBets.map(bet => ({
        id: bet.id,
        question: bet.question,
        selectedOption: bet.selectedOption,
        entryFee: bet.entryFee,
        timestamp: bet.timestamp,
        endTime: bet.endTime,
        status: bet.status,
        prizeAmount: bet.prizeAmount,
        claimed: bet.claimed,
        totalParticipants: bet.totalParticipants
      })),
      userStats,
      userAddress
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cosmic-dark relative overflow-hidden">
        <Header />
        <main className="relative z-10 pt-32 pb-20 px-6 flex justify-center">
             <div className="text-white animate-pulse flex items-center gap-2">
                <RefreshCw className="animate-spin" /> Loading Blockchain Data...
             </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cosmic-dark relative overflow-hidden">
      <div className="absolute inset-0 cosmic-gradient" />
      <Header />

      <main className="relative z-10 pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-8 md:mb-12">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 md:w-8 md:h-8 text-cosmic-purple" />
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white text-glow">
                  Dashboard
                </h1>
              </div>
              {userAddress && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full w-fit">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-text-muted text-xs sm:text-sm font-mono">
                    {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
                  </p>
                </div>
              )}
            </div>
            <p className="text-text-muted text-base md:text-lg">
              Track your predictions and earnings
            </p>
          </div>

          {error && (
            <div className="mb-8 bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-lg">
              {error}
            </div>
          )}

          {/* === NEW: ACTION REQUIRED SECTION (Resolve / Claim) === */}
          {marketsToResolve.length > 0 && (
            <div id="action-required-section" className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="bg-linear-to-r from-orange-500/20 to-red-600/10 border border-orange-500/40 rounded-2xl p-6 shadow-lg shadow-orange-500/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-500/20 rounded-lg">
                     <AlertTriangle className="w-6 h-6 text-orange-400 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">
                       {/* Judul dinamis sesuai peran */}
                       {marketsToResolve[0].userRole === 'participant' 
                         ? (marketsToResolve[0].isEmergency ? 'Force Claim Available' : 'Pending Resolution') 
                         : 'Action Required: Resolve Markets'}
                    </h3>
                    <p className="text-sm text-orange-200/80">
                      {marketsToResolve[0].userRole === 'participant' 
                        ? (marketsToResolve[0].isEmergency 
                            ? "Creator failed to resolve. You can now FORCE RESOLVE to receive your winnings." 
                            : "Market ended but prizes pending. Waiting for creator to resolve.")
                        : "These markets have ended. Please select the winner to distribute prizes."}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 mt-4">
                  {marketsToResolve.map((market) => (
                    <div key={market.id} className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-5 hover:border-orange-500/30 transition-all">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                             <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-text-muted font-mono border border-white/5">
                               ID: #{market.id}
                             </span>
                             {market.isEmergency ? (
                               <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/20 font-bold flex items-center gap-1">
                                 <Zap className="w-3 h-3" /> FORCE CLAIM READY
                               </span>
                             ) : (
                               <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 font-bold flex items-center gap-1">
                                 <Clock className="w-3 h-3" /> PENDING RESOLUTION
                               </span>
                             )}
                             <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                               <DollarSign className="w-3 h-3" /> Pool: {market.prizePool} STT
                             </span>
                          </div>
                          <h4 className="text-lg md:text-xl font-semibold text-white">{market.question}</h4>
                          <div className="flex items-center gap-4 text-xs text-text-muted">
                            <span className="flex items-center gap-1">
                              <Activity className="w-3 h-3" /> {market.totalParticipants} Participants
                            </span>
                            <span>
                              Ended: {market.endTime.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <div className="min-w-[200px]">
                          {/* Logic Tombol: Muncul jika Creator ATAU jika Emergency Mode */}
                          {(market.userRole === 'creator' || market.isEmergency) ? (
                            <>
                                <label className="text-xs uppercase tracking-wider text-text-muted mb-2 block font-semibold">
                                  {market.userRole === 'participant' ? 'Select Winning Outcome (Force):' : 'Select Winner:'}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                  {market.options.map((option, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => {
                                        const confirmMsg = market.isEmergency 
                                          ? `FORCE CLAIM: Confirm "${option}" won? Prizes will be distributed immediately.`
                                          : `Confirm that "${option}" won? Prizes will be distributed immediately.`;
                                          
                                        if (window.confirm(confirmMsg)) {
                                          handleResolveMarket(market, idx);
                                        }
                                      }}
                                      disabled={resolvingId === market.id}
                                      className={`
                                        relative px-4 py-2 rounded-lg text-sm font-medium transition-all
                                        ${resolvingId === market.id 
                                          ? 'bg-white/5 text-gray-500 cursor-wait' 
                                          : 'bg-white/10 hover:bg-emerald-500 hover:text-white border border-white/10 hover:border-emerald-400 text-gray-200'
                                        }
                                      `}
                                    >
                                      {resolvingId === market.id ? 'Processing...' : option}
                                    </button>
                                  ))}
                                </div>
                            </>
                          ) : (
                            // Tampilan jika Peserta harus menunggu
                            <div className="p-3 bg-white/5 rounded-lg border border-dashed border-white/20">
                                <p className="text-sm text-text-muted text-center">
                                    Funds are currently locked.
                                    <br />
                                    <span className="text-xs text-yellow-400/80">
                                        If creator doesn't resolve by {new Date(market.resolutionTime.getTime() + (7*24*60*60*1000)).toLocaleDateString()}, you can Force Claim here.
                                    </span>
                                </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* === END SECTION === */}

          {/* Quick Actions */}
          {userStats && (
            <QuickActions 
              unclaimedPrizes={unclaimedPrizes}
              onExport={handleExport}
              onClaimAll={handleClaimAll}
            />
          )}

          {/* Notification Alerts */}
          {userStats && (
            <NotificationAlert 
              unclaimedPrizes={unclaimedPrizes}
              closingSoonBets={closingSoonBets}
              onClaimAll={handleClaimAll}
            />
          )}

          {/* Statistics Cards */}
          {userStats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              <EnhancedStatCard
                title="Total Predictions"
                value={userStats.totalPredictions.toString()}
                icon={<Target className="w-8 h-8" />}
                iconColor="text-cosmic-purple"
                iconBgColor="bg-cosmic-purple/20"
                gradient="from-cosmic-purple to-purple-600"
              />
              <EnhancedStatCard
                title="Win Rate"
                value={`${Math.round(winRate)}%`}
                subtitle={`${userStats.correctPredictions} / ${userStats.totalPredictions} correct`}
                icon={<Trophy className="w-8 h-8" />}
                iconColor="text-emerald-400"
                iconBgColor="bg-emerald-400/20"
                gradient="from-emerald-500 to-green-600"
              />
              <EnhancedStatCard
                title="Total Winnings"
                value={`${parseFloat(userStats.totalWinnings).toFixed(4)} STT`}
                icon={<DollarSign className="w-8 h-8" />}
                iconColor="text-yellow-400"
                iconBgColor="bg-yellow-400/20"
                gradient="from-yellow-500 to-orange-500"
              />
              <EnhancedStatCard
                title="Wallet Balance"
                value={`${parseFloat(userStats.walletBalance).toFixed(4)} STT`}
                icon={<Wallet className="w-8 h-8" />}
                iconColor="text-cosmic-blue"
                iconBgColor="bg-cosmic-blue/20"
                gradient="from-cosmic-blue to-blue-600"
              />
            </div>
          )}

          {/* Performance Overview */}
          {userStats && (
            <div className="bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-8 mb-8 md:mb-12">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-4 md:mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-cosmic-purple" />
                Performance Overview
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Current Streak */}
                {/* @ts-ignore */}
                <div className="group relative bg-linear-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-2xl p-6 hover:border-orange-500/40 transition-all duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 rounded-xl bg-orange-400/20 group-hover:scale-110 transition-transform duration-300">
                      <TrendingUp className="w-6 h-6 text-orange-400" />
                    </div>
                    {userStats.currentStreak > 0 && (
                      <span className="text-2xl">🔥</span>
                    )}
                  </div>
                  <p className="text-text-muted text-sm mb-1">Current Streak</p>
                  <p className="text-3xl font-bold text-white text-glow">{userStats.currentStreak}</p>
                </div>

                {/* Longest Streak */}
                {/* @ts-ignore */}
                <div className="group relative bg-linear-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-2xl p-6 hover:border-purple-500/40 transition-all duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 rounded-xl bg-purple-400/20 group-hover:scale-110 transition-transform duration-300">
                      <Award className="w-6 h-6 text-purple-400" />
                    </div>
                    {userStats.longestStreak >= 5 && (
                      <span className="text-2xl">⭐</span>
                    )}
                  </div>
                  <p className="text-text-muted text-sm mb-1">Longest Streak</p>
                  <p className="text-3xl font-bold text-white text-glow">{userStats.longestStreak}</p>
                </div>

                {/* Accuracy */}
                {/* @ts-ignore */}
                <div className="group relative bg-linear-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-2xl p-6 hover:border-blue-500/40 transition-all duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-text-muted text-sm mb-1">Accuracy</p>
                      <p className="text-3xl font-bold text-white text-glow mb-2">
                        {userStats.accuracyPercentage.toFixed(1)}%
                      </p>
                      <div className="flex items-center gap-1 text-xs text-blue-400">
                        <Target className="w-3 h-3" />
                        <span>Precision Rate</span>
                      </div>
                    </div>
                    <div className="scale-75">
                      <ProgressRing 
                        percentage={userStats.accuracyPercentage} 
                        size={80}
                        strokeWidth={6}
                        color="#3b82f6"
                      />
                    </div>
                  </div>
                </div>

                {/* Total Points */}
                {/* @ts-ignore */}
                <div className="group relative bg-linear-to-br from-cosmic-purple/10 to-cosmic-blue/5 border border-cosmic-purple/20 rounded-2xl p-6 hover:border-cosmic-purple/40 transition-all duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 rounded-xl bg-cosmic-purple/20 group-hover:scale-110 transition-transform duration-300">
                      <Trophy className="w-6 h-6 text-cosmic-purple" />
                    </div>
                    {userStats.totalPoints >= 100 && (
                      <span className="text-2xl">🏆</span>
                    )}
                  </div>
                  <p className="text-text-muted text-sm mb-1">Total Points</p>
                  <p className="text-3xl font-bold text-white text-glow">{userStats.totalPoints}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <TabNavigation
            selectedTab={selectedTab}
            onTabChange={setSelectedTab}
            activeBetsCount={activeBetsOnly.length}
          />

          {/* Content based on selected tab */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            {/* Left column - Active Bets / Bet History */}
            <div className="lg:col-span-2">
              {selectedTab === "Active Bets" && (
                <div>
                  <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-2">
                    <Target className="w-7 h-7 text-cosmic-purple" />
                    Your Active Bets
                  </h2>
                  <div className="space-y-4">
                    {activeBetsOnly.length > 0 ? (
                      activeBetsOnly.map((bet) => (
                        <BetCard
                          key={bet.id}
                          id={bet.id}
                          question={bet.question}
                          selectedOption={bet.selectedOption}
                          entryFee={bet.entryFee}
                          endTime={bet.endTime}
                          status={bet.status}
                          prizeAmount={bet.prizeAmount}
                          claimed={bet.claimed}
                          totalParticipants={bet.totalParticipants}
                        />
                      ))
                    ) : (
                      <EmptyState
                        emoji="🎯"
                        title="No Active Bets"
                        description="You don't have any active predictions yet. Start predicting on markets to see them here!"
                        actionText="Explore Markets"
                        actionHref="/markets"
                      />
                    )}
                  </div>
                </div>
              )}

              {selectedTab === "Bet History" && (
                <div>
                  <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-2">
                    <Trophy className="w-7 h-7 text-cosmic-purple" />
                    Bet History
                  </h2>
                  
                  {activeBets.length > 0 && (
                    <BetHistoryFilters
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      statusFilter={statusFilter}
                      onStatusFilterChange={setStatusFilter}
                      sortOption={sortOption}
                      onSortChange={setSortOption}
                      resultsCount={filteredBets.length}
                    />
                  )}

                  <div className="space-y-4">
                    {filteredBets.length > 0 ? (
                      filteredBets.map((bet) => (
                        <BetCard
                          key={bet.id}
                          id={bet.id}
                          question={bet.question}
                          selectedOption={bet.selectedOption}
                          entryFee={bet.entryFee}
                          endTime={bet.endTime}
                          status={bet.status}
                          prizeAmount={bet.prizeAmount}
                          claimed={bet.claimed}
                          totalParticipants={bet.totalParticipants}
                        />
                      ))
                    ) : activeBets.length === 0 ? (
                      <EmptyState
                        emoji="📊"
                        title="No Bet History"
                        description="Your prediction history will appear here once you start participating in markets."
                        actionText="Start Predicting"
                        actionHref="/markets"
                      />
                    ) : (
                      <EmptyState
                        emoji="🔍"
                        title="No matching bets"
                        description={`No bets found matching your search "${searchQuery}"`}
                      />
                    )}
                  </div>
                </div>
              )}

              {selectedTab === "Achievements" && (
                <div>
                  <h2 className="text-3xl font-bold text-white mb-6 flex items-center gap-2">
                    <Award className="w-7 h-7 text-cosmic-purple" />
                    Achievements
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <AchievementCard
                      emoji="🔥"
                      title="Streak Master"
                      description={`Achieved ${userStats?.longestStreak || 0} prediction streak`}
                      borderColor="border-orange-500/30"
                      glowColor="bg-orange-500"
                      unlocked={userStats ? userStats.longestStreak >= 3 : false}
                    />
                    <AchievementCard
                      emoji="🎯"
                      title="Sharp Predictor"
                      description={`${userStats?.accuracyPercentage.toFixed(1) || 0}% accuracy rate`}
                      borderColor="border-emerald-500/30"
                      glowColor="bg-emerald-500"
                      unlocked={userStats ? userStats.accuracyPercentage >= 70 && userStats.totalPredictions >= 5 : false}
                    />
                    <AchievementCard
                      emoji="📈"
                      title="Active Trader"
                      description={`Made ${userStats?.totalPredictions || 0}+ predictions`}
                      borderColor="border-blue-500/30"
                      glowColor="bg-blue-500"
                      unlocked={userStats ? userStats.totalPredictions >= 10 : false}
                    />
                    <AchievementCard
                      emoji="⭐"
                      title="Point Collector"
                      description={`Earned ${userStats?.totalPoints || 0} points`}
                      borderColor="border-yellow-500/30"
                      glowColor="bg-yellow-500"
                      unlocked={userStats ? userStats.totalPoints >= 100 : false}
                    />
                    <AchievementCard
                      emoji="💰"
                      title="Big Winner"
                      description={`Total winnings: ${parseFloat(userStats?.totalWinnings || "0").toFixed(4)} STT`}
                      borderColor="border-purple-500/30"
                      glowColor="bg-purple-500"
                      unlocked={userStats ? parseFloat(userStats.totalWinnings) >= 1 : false}
                    />
                    <AchievementCard
                      emoji="🎊"
                      title="First Steps"
                      description="Made your first prediction"
                      borderColor="border-cyan-500/30"
                      glowColor="bg-cyan-500"
                      unlocked={userStats ? userStats.totalPredictions >= 1 : false}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right column - Recent Activity */}
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Activity className="w-6 h-6 text-cosmic-purple" />
                  Recent Activity
                </h2>
                <div className="max-h-[600px] overflow-y-auto scrollbar-hide">
                  {activities.length > 0 ? (
                    <ActivityFeed activities={activities} />
                  ) : (
                    <EmptyState
                      emoji="📭"
                      title="No Activity"
                      description="Your recent activity will appear here"
                    />
                  )}
                </div>

                {/* Refresh Button */}
                <button
                  onClick={connectAndFetchData}
                  disabled={loading}
                  className="w-full mt-6 py-3 bg-linear-to-r from-cosmic-purple/20 to-cosmic-blue/20 hover:from-cosmic-purple/30 hover:to-cosmic-blue/30 border border-cosmic-purple/50 rounded-xl text-white font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                >
                  <span className="group-hover:rotate-180 transition-transform duration-500">
                    <RefreshCw className="w-5 h-5" />
                  </span>
                  <span>{loading ? "Refreshing..." : "Refresh Dashboard"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}