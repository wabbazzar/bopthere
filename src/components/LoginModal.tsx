import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogIn, Eye, EyeOff } from 'lucide-react';
import { useCharacter } from '@/contexts/CharacterContext';
import { useAuth } from '@/contexts/AuthContext';
import { characterThemes } from '@/types/character';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { selectedCharacter } = useCharacter();
  const { login, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const theme = selectedCharacter ? characterThemes[selectedCharacter] : characterThemes.wesley;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      await login(username.trim(), password);
      onClose();
      setUsername('');
      setPassword('');
    } catch (error) {
      // Error handling is done in the AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setUsername('');
      setPassword('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-w-[95vw] mx-auto">
        <DialogHeader>
          <DialogTitle 
            className="text-center text-2xl font-cinzel"
            style={{ color: theme.primary }}
          >
            Epic Quest Login
          </DialogTitle>
        </DialogHeader>
        
        <Card className="border-2" style={{ borderColor: theme.secondary }}>
          <CardHeader className="pb-4">
            <CardTitle 
              className="text-lg font-cinzel text-center"
              style={{ color: theme.primary }}
            >
              Access Your Festival Experience
            </CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to unlock your personalized wedding quest
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">
                  Username
                </Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  disabled={isSubmitting}
                  required
                  autoComplete="username"
                  enterKeyHint="next"
                  className="transition-colors focus:ring-2"
                  style={{
                    borderColor: theme.secondary,
                    '--tw-ring-color': theme.secondary,
                  } as React.CSSProperties}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={isSubmitting}
                    required
                    autoComplete="current-password"
                    enterKeyHint="done"
                    className="pr-10 transition-colors focus:ring-2"
                    style={{
                      borderColor: theme.secondary,
                      '--tw-ring-color': theme.secondary,
                    } as React.CSSProperties}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" style={{ color: theme.primary }} />
                    ) : (
                      <Eye className="h-4 w-4" style={{ color: theme.primary }} />
                    )}
                  </Button>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="flex-1 transition-colors"
                  style={{
                    borderColor: theme.secondary,
                    color: theme.primary,
                  }}
                >
                  Cancel
                </Button>
                
                <Button
                  type="submit"
                  disabled={isSubmitting || !username.trim() || !password.trim()}
                  className="flex-1 text-white font-medium transition-all hover:opacity-90"
                  style={{ backgroundColor: theme.primary }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 mr-2" />
                      Login
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        
        {/* Character-themed footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Join the epic celebration • December 5-9, 2025 • Maui, Hawaii</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};