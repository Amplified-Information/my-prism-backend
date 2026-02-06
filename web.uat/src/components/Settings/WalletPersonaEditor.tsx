import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WalletPersonaEditorProps {
  walletId: string;
  onSave?: () => void;
}

const PERSONA_COLORS = [
  { name: "Yellow", value: "#FEFF9D" },
  { name: "Coral", value: "#FF6B6B" },
  { name: "Teal", value: "#4ECDC4" },
  { name: "Purple", value: "#9B5DE5" },
  { name: "Orange", value: "#F97316" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#22C55E" },
  { name: "Pink", value: "#EC4899" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Cyan", value: "#06B6D4" },
  { name: "Lime", value: "#84CC16" },
  { name: "Rose", value: "#F43F5E" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Slate", value: "#64748B" },
];

const WalletPersonaEditor = ({ walletId, onSave }: WalletPersonaEditorProps) => {
  const [personaName, setPersonaName] = useState("");
  const [personaColor, setPersonaColor] = useState(PERSONA_COLORS[0].value);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalName, setOriginalName] = useState("");

  useEffect(() => {
    const fetchPersona = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("hedera_wallets")
          .select("persona_name, persona_color")
          .eq("account_id", walletId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setPersonaName(data.persona_name || "");
          setOriginalName(data.persona_name || "");
          setPersonaColor(data.persona_color || PERSONA_COLORS[0].value);
        }
      } catch (error) {
        console.error("Error fetching persona:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPersona();
  }, [walletId]);

  const handleSave = async () => {
    if (!personaName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a persona name",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Check if name is already taken (if changed)
      if (personaName !== originalName) {
        const { data: existing } = await supabase
          .from("hedera_wallets")
          .select("account_id")
          .eq("persona_name", personaName.trim())
          .neq("account_id", walletId)
          .maybeSingle();

        if (existing) {
          toast({
            title: "Name taken",
            description: "This persona name is already in use. Please choose another.",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }
      }

      const { error } = await supabase
        .from("hedera_wallets")
        .update({
          persona_name: personaName.trim(),
          persona_color: personaColor,
        })
        .eq("account_id", walletId);

      if (error) throw error;

      setOriginalName(personaName.trim());
      toast({
        title: "Persona saved",
        description: "Your wallet persona has been updated",
      });
      onSave?.();
    } catch (error) {
      console.error("Error saving persona:", error);
      toast({
        title: "Error",
        description: "Failed to save persona. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="persona-name">Display Name</Label>
        <Input
          id="persona-name"
          value={personaName}
          onChange={(e) => setPersonaName(e.target.value)}
          placeholder="Enter your unique display name"
          maxLength={30}
        />
        <p className="text-xs text-muted-foreground">
          This name will be shown in discussions instead of your wallet address.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Avatar Color</Label>
        <div className="flex flex-wrap gap-2">
          {PERSONA_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => setPersonaColor(color.value)}
              className={cn(
                "relative h-8 w-8 rounded-full transition-all duration-200",
                "ring-2 ring-offset-2 ring-offset-background",
                personaColor === color.value
                  ? "ring-primary scale-110"
                  : "ring-transparent hover:ring-muted-foreground/50"
              )}
              style={{ backgroundColor: color.value }}
              title={color.name}
            >
              {personaColor === color.value && (
                <Check className="absolute inset-0 m-auto h-4 w-4 text-black" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Preview</Label>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-black font-bold"
            style={{ backgroundColor: personaColor }}
          >
            {personaName ? personaName[0].toUpperCase() : "?"}
          </div>
          <div>
            <p className="font-medium text-sm">
              {personaName || "Your Display Name"}
            </p>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {walletId}
            </p>
          </div>
        </div>
      </div>

      <div className="pt-2 px-4">
        <Button
          onClick={handleSave}
          disabled={isSaving || !personaName.trim()}
          className="w-full"
          variant="trading"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Persona"
          )}
        </Button>
      </div>
    </div>
  );
};

export default WalletPersonaEditor;
