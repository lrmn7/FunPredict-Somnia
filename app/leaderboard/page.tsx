"use client";
export const runtime = 'edge';
import Header from "@/components/Header";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";

import { useLeaderboard } from "./leaderboardMockData";

export default function LeaderboardPage() {
  const { data, loading } = useLeaderboard();

  return (
    <div className="min-h-screen bg-cosmic-dark relative overflow-hidden">
      <div className="absolute inset-0 cosmic-gradient" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-96 h-96 bg-cosmic-purple/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cosmic-blue/20 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <Header />

      <main className="relative z-10 pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12 text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 text-glow">
              Leaderboard
            </h1>
            <p className="text-text-muted text-lg">
              Top predictors competing for glory and rewards
            </p>
          </div>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              {/* Spinner Loading */}
              <div className="w-12 h-12 border-4 border-cosmic-purple border-t-transparent rounded-full animate-spin" />
              <p className="text-white/60 font-medium">Syncing live data from Somnia Chain...</p>
            </div>
          ) : (
            data.length > 0 ? (
              <LeaderboardTable entries={data} />
            ) : (
              <div className="text-center py-10 border border-white/10 rounded-xl bg-white/5 backdrop-blur-sm">
                <p className="text-white/80 text-xl">There is no data on the Blockchain yet.</p>
                <p className="text-white/50 text-sm mt-2">Be the first to make a prediction!</p>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}