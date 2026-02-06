import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import WalletPersonaEditor from "./WalletPersonaEditor";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletId: string | null;
}

const SettingsDialog = ({ 
  open, 
  onOpenChange, 
  walletId
}: SettingsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Wallet Persona</DialogTitle>
          <DialogDescription>
            Customize how you appear in discussions
          </DialogDescription>
        </DialogHeader>
        
        {walletId ? (
          <div className="mt-4 overflow-hidden">
            <WalletPersonaEditor walletId={walletId} onSave={() => onOpenChange(false)} />
          </div>
        ) : (
          <div className="mt-6 text-center text-muted-foreground">
            <p>Connect your wallet to access settings.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
