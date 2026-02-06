import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Clock, Wifi } from 'lucide-react';

interface InactivityWarningDialogProps {
  open: boolean;
  onExtendSession: () => void;
  onDisconnect: () => void;
  warningDuration: number; // in milliseconds
}

export const InactivityWarningDialog: React.FC<InactivityWarningDialogProps> = ({
  open,
  onExtendSession,
  onDisconnect,
  warningDuration,
}) => {
  const [timeLeft, setTimeLeft] = useState(warningDuration);

  useEffect(() => {
    if (!open) {
      setTimeLeft(warningDuration);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1000;
        if (newTime <= 0) {
          onDisconnect();
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, warningDuration, onDisconnect]);

  const progress = ((warningDuration - timeLeft) / warningDuration) * 100;
  const secondsLeft = Math.ceil(timeLeft / 1000);

  const handleExtendSession = () => {
    onExtendSession();
    setTimeLeft(warningDuration);
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            Session Timeout Warning
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              Your wallet will be automatically disconnected in <strong>{secondsLeft} seconds</strong> due to inactivity.
            </p>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Time remaining:</span>
                <span className="font-mono">{secondsLeft}s</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Wifi className="h-4 w-4" />
                <span>This is a security feature to protect your wallet from unauthorized access.</span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel 
            onClick={onDisconnect}
          >
            Disconnect Now
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleExtendSession}
            className="bg-primary hover:bg-primary/90"
          >
            <Clock className="h-4 w-4 mr-2" />
            Extend Session (20 min)
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};