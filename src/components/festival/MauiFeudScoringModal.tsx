import React from 'react';
import { MauiFeudScoringModalProps } from '@/types/mauiFeud';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export const MauiFeudScoringModal: React.FC<MauiFeudScoringModalProps> = ({
  isOpen,
  teams,
  availablePoints,
  questionText,
  theme,
  onSelectTeam,
  onClose,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'Cinzel, serif', color: theme.primary }}>
            Award Points
          </DialogTitle>
          <DialogDescription style={{ fontFamily: 'Crimson Text, serif' }}>
            {questionText}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Available Points</p>
            <p className="text-5xl font-bold" style={{ color: theme.primary }}>
              {availablePoints}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {teams.map((team, index) => (
              <Button
                key={index}
                onClick={() => {
                  onSelectTeam(index as 0 | 1);
                }}
                className="flex flex-col items-center p-6 h-auto text-white hover:opacity-90"
                style={{ backgroundColor: theme.primary }}
              >
                <span className="text-lg font-bold mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                  {team.name}
                </span>
                <span className="text-sm">Current Score: {team.score}</span>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
