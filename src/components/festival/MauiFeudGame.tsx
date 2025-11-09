import React, { useState, useEffect } from 'react';
import { MauiFeudGameProps, GameState, MauiFeudQuestion } from '@/types/mauiFeud';
import { MauiFeudTeamSetup } from './MauiFeudTeamSetup';
import { MauiFeudAnswerCard } from './MauiFeudAnswerCard';
import { MauiFeudScoringModal } from './MauiFeudScoringModal';
import { MauiFeudFinalScreen } from './MauiFeudFinalScreen';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import processedGameData from '@/data/maui_feud_questions.json';

// Helper function to initialize game questions with revealed state
function loadGameQuestions(): MauiFeudQuestion[] {
  return processedGameData.questions.map((q) => ({
    ...q,
    answers: q.answers.map((a) => ({ ...a, revealed: false })),
    allRevealed: false,
  }));
}

export const MauiFeudGame: React.FC<MauiFeudGameProps> = ({
  character,
  theme,
  onGameStateChange,
}) => {
  const [showScoringModal, setShowScoringModal] = useState(false);

  const [gameState, setGameState] = useState<GameState>(() => {
    // Try to load from localStorage
    const stored = localStorage.getItem(`maui-feud-game-state-${character}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Convert revealedAnswers array back to Set
        return {
          ...parsed,
          revealedAnswers: new Set(parsed.revealedAnswers || []),
        };
      } catch (e) {
        console.error('Failed to parse stored game state:', e);
      }
    }

    // Initialize new game from processed data file
    return {
      gamePhase: 'setup',
      teams: [
        { name: '', score: 0 },
        { name: '', score: 0 },
      ],
      currentQuestionIndex: 0,
      questions: loadGameQuestions(),
      revealedAnswers: new Set<string>(),
    };
  });

  // Save to localStorage on every state change
  useEffect(() => {
    const stateToSave = {
      ...gameState,
      // Convert Set to array for JSON serialization
      revealedAnswers: Array.from(gameState.revealedAnswers),
    };
    localStorage.setItem(`maui-feud-game-state-${character}`, JSON.stringify(stateToSave));
  }, [gameState, character]);

  // Notify parent of game state changes
  useEffect(() => {
    if (onGameStateChange) {
      onGameStateChange(gameState.gamePhase, gameState.teams);
    }
  }, [gameState.gamePhase, gameState.teams, onGameStateChange]);

  const handleStartGame = (team1Name: string, team2Name: string) => {
    setGameState((prev) => ({
      ...prev,
      gamePhase: 'playing',
      teams: [
        { name: team1Name, score: 0 },
        { name: team2Name, score: 0 },
      ],
    }));
  };

  const resetGame = () => {
    // Clear localStorage
    localStorage.removeItem(`maui-feud-game-state-${character}`);

    // Reset game state to initial setup
    setGameState({
      gamePhase: 'setup',
      teams: [
        { name: '', score: 0 },
        { name: '', score: 0 },
      ],
      currentQuestionIndex: 0,
      questions: loadGameQuestions(),
      revealedAnswers: new Set<string>(),
    });
  };

  const handleRestart = () => {
    if (window.confirm('Are you sure you want to restart the game? All progress will be lost.')) {
      resetGame();
    }
  };

  // Render based on game phase
  if (gameState.gamePhase === 'setup') {
    return (
      <MauiFeudTeamSetup theme={theme} character={character} onStartGame={handleStartGame} />
    );
  }

  // Playing phase - question display and answer revelation
  if (gameState.gamePhase === 'playing') {
    const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
    const allAnswersRevealed = currentQuestion.answers.every((a) => a.revealed);
    const totalPointsAvailable = currentQuestion.answers
      .filter((a) => a.revealed)
      .reduce((sum, a) => sum + a.count, 0);

    const handleRevealAnswer = (answerIndex: number) => {
      const updatedQuestions = [...gameState.questions];
      updatedQuestions[gameState.currentQuestionIndex].answers[answerIndex].revealed = true;
      updatedQuestions[gameState.currentQuestionIndex].allRevealed =
        updatedQuestions[gameState.currentQuestionIndex].answers.every((a) => a.revealed);
      setGameState((prev) => ({ ...prev, questions: updatedQuestions }));
    };

    const handleScoreTeam = (teamIndex: 0 | 1) => {
      const pointsToAdd = totalPointsAvailable;
      setGameState((prev) => {
        const updatedTeams = [...prev.teams] as [typeof prev.teams[0], typeof prev.teams[1]];
        updatedTeams[teamIndex] = {
          ...updatedTeams[teamIndex],
          score: updatedTeams[teamIndex].score + pointsToAdd,
        };

        // Check if this was the last question
        const isLastQuestion = prev.currentQuestionIndex === prev.questions.length - 1;

        return {
          ...prev,
          teams: updatedTeams,
          gamePhase: isLastQuestion ? 'finished' : 'playing',
          currentQuestionIndex: isLastQuestion
            ? prev.currentQuestionIndex
            : prev.currentQuestionIndex + 1,
        };
      });
      setShowScoringModal(false);
    };

    return (
      <div className="space-y-6">
        {/* Question Display Card */}
        <Card
          className="bg-white/95 backdrop-blur-sm border-4 shadow-2xl"
          style={{ borderColor: theme.primary }}
        >
          <CardHeader
            className="text-center pb-6"
            style={{ background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})` }}
          >
            <CardTitle className="text-2xl text-white" style={{ fontFamily: 'Cinzel, serif' }}>
              Question {gameState.currentQuestionIndex + 1} of {gameState.questions.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p
              className="text-3xl text-center font-bold mb-8"
              style={{ fontFamily: 'Crimson Text, serif', color: theme.dark }}
            >
              {currentQuestion.text}
            </p>

            {/* Answer Cards Grid - Variable count (2-8+ cards) */}
            <div
              className={`grid gap-4 mb-6 ${
                currentQuestion.answers.length <= 3
                  ? 'grid-cols-1 md:grid-cols-3' // 1-3 answers: 3 columns
                  : currentQuestion.answers.length <= 6
                    ? 'grid-cols-2 md:grid-cols-3' // 4-6 answers: 3 columns
                    : 'grid-cols-2 md:grid-cols-4' // 7+ answers: 4 columns
              }`}
            >
              {currentQuestion.answers.map((answer, index) => (
                <MauiFeudAnswerCard
                  key={index}
                  answer={answer}
                  theme={theme}
                  disabled={answer.revealed}
                  onClick={() => handleRevealAnswer(index)}
                />
              ))}
            </div>

            {/* Navigation and Scoring Buttons */}
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button
                  onClick={handleRestart}
                  variant="outline"
                  style={{
                    borderColor: theme.primary,
                    color: theme.primary,
                  }}
                >
                  <RotateCcw className="mr-2 w-4 h-4" />
                  Restart
                </Button>
                <Button
                  disabled={gameState.currentQuestionIndex === 0}
                  onClick={() =>
                    setGameState((prev) => ({
                      ...prev,
                      currentQuestionIndex: prev.currentQuestionIndex - 1,
                    }))
                  }
                  variant="outline"
                  style={{
                    borderColor: theme.primary,
                    color: gameState.currentQuestionIndex === 0 ? undefined : theme.primary,
                  }}
                >
                  <ArrowLeft className="mr-2" />
                  Previous
                </Button>
              </div>

              {allAnswersRevealed && (
                <Button
                  onClick={() => setShowScoringModal(true)}
                  className="text-white"
                  style={{ backgroundColor: theme.primary }}
                >
                  Score Points
                </Button>
              )}

              <Button
                disabled={gameState.currentQuestionIndex === gameState.questions.length - 1}
                onClick={() =>
                  setGameState((prev) => ({
                    ...prev,
                    currentQuestionIndex: prev.currentQuestionIndex + 1,
                  }))
                }
                variant="outline"
                style={{
                  borderColor: theme.primary,
                  color:
                    gameState.currentQuestionIndex === gameState.questions.length - 1
                      ? undefined
                      : theme.primary,
                }}
              >
                Next
                <ArrowRight className="ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Scoring Modal */}
        <MauiFeudScoringModal
          isOpen={showScoringModal}
          teams={gameState.teams}
          availablePoints={totalPointsAvailable}
          questionText={currentQuestion.text}
          theme={theme}
          onSelectTeam={handleScoreTeam}
          onClose={() => setShowScoringModal(false)}
        />
      </div>
    );
  }

  // Finished phase - final screen with winner and scores
  return (
    <MauiFeudFinalScreen
      teams={gameState.teams}
      theme={theme}
      character={character}
      onPlayAgain={resetGame}
    />
  );
};
