import { useState, useEffect } from "react";
import { History, FileText, Trophy, Target, Calendar } from "lucide-react";
import { getQuizHistoryWithSync, QuizHistoryEntry } from "@/lib/quizHistory";
import { migrateLocalQuizHistory } from "@/lib/firestoreService";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export const HistoryView = () => {
  const [history, setHistory] = useState<QuizHistoryEntry[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const loadHistory = async () => {
      // Migrate localStorage data to Firestore on first load
      if (user) {
        await migrateLocalQuizHistory(user.uid);
      }
      const data = await getQuizHistoryWithSync(user?.uid ?? null);
      setHistory(data);
    };
    loadHistory();
  }, [user]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString();
  };

  const getScoreColor = (pct: number) => {
    if (pct >= 80) return "text-green-500";
    if (pct >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBg = (pct: number) => {
    if (pct >= 80) return "bg-green-500/10 border-green-500/30";
    if (pct >= 60) return "bg-yellow-500/10 border-yellow-500/30";
    return "bg-red-500/10 border-red-500/30";
  };

  // Empty state
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-24 h-24 rounded-3xl bg-secondary/80 flex items-center justify-center mb-8">
          <History className="w-12 h-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-3">No history yet</h2>
        <p className="text-muted-foreground text-center max-w-md mb-8">
          Your completed quizzes will appear here. Generate and complete a quiz to get started!
        </p>
      </div>
    );
  }

  // Stats summary
  const totalQuizzes = history.length;
  const avgScore = Math.round(history.reduce((sum, e) => sum + e.percentage, 0) / totalQuizzes);
  const bestScore = Math.max(...history.map(e => e.percentage));

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">Quiz History</h2>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-card/50 border border-border/50 rounded-xl p-4 text-center">
          <Target className="w-5 h-5 text-primary mx-auto mb-1" />
          <div className="text-2xl font-bold text-foreground">{totalQuizzes}</div>
          <div className="text-xs text-muted-foreground">Quizzes Taken</div>
        </div>
        <div className="bg-card/50 border border-border/50 rounded-xl p-4 text-center">
          <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
          <div className={cn("text-2xl font-bold", getScoreColor(bestScore))}>{bestScore}%</div>
          <div className="text-xs text-muted-foreground">Best Score</div>
        </div>
        <div className="bg-card/50 border border-border/50 rounded-xl p-4 text-center">
          <Calendar className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <div className={cn("text-2xl font-bold", getScoreColor(avgScore))}>{avgScore}%</div>
          <div className="text-xs text-muted-foreground">Average</div>
        </div>
      </div>

      {/* History List */}
      <div className="space-y-3">
        {history.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              "p-4 rounded-xl border transition-colors",
              getScoreBg(entry.percentage)
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("text-2xl font-bold", getScoreColor(entry.percentage))}>
                    {entry.percentage}%
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({entry.score}/{entry.totalQuestions})
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span className="capitalize px-2 py-0.5 rounded-full bg-secondary">{entry.difficulty}</span>
                  {entry.questionTypes.map(t => (
                    <span key={t} className="px-2 py-0.5 rounded-full bg-secondary capitalize">
                      {t.replace('-', ' ')}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="w-3 h-3" />
                  <span className="truncate">{entry.sourceFiles.join(', ')}</span>
                </div>
              </div>

              <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(entry.completedAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
