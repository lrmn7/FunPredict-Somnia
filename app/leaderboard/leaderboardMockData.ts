"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import PrizePoolPredictionABI from "@/app/ABIs/Prediction.json";
export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  points: number;
  streak: number;
  ensName?: string;
}

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_FUN_PREDICT_CONTRACT_ADDRESS as `0x${string}`;
const RPC_URL = "https://dream-rpc.somnia.network";

export function useLeaderboard() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const contract = new ethers.Contract(
          CONTRACT_ADDRESS,
          PrizePoolPredictionABI.abi,
          provider
        );
        const [users, points, streaks] = await contract.getPointsLeaderboard();
        const formattedData: LeaderboardEntry[] = users.map((user: string, index: number) => ({
          rank: index + 1,
          wallet: user,
          points: Number(points[index]),
          streak: Number(streaks[index]),
          ensName: undefined
        }));

        setData(formattedData);
      } catch (error) {
        console.error("Failed fecth leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return { data, loading };
}