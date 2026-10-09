import { useUIContext } from '../src/contexts/UIContext'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../src/components/ui/sheet'
import { Coins } from 'lucide-react'
import AllowanceManager from './AllowanceManager'

const GlobalAllowanceSidebar = () => {
  const { 
    showAllowanceSidebar, 
    setShowAllowanceSidebar
  } = useUIContext()

  return (
    <Sheet open={showAllowanceSidebar} onOpenChange={setShowAllowanceSidebar}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Allowance Manager
          </SheetTitle>
          <SheetDescription>
            Manage your USDC spending permissions for the trading contract
          </SheetDescription>
        </SheetHeader>
        
        <AllowanceManager 
          onAllowanceGranted={() => setShowAllowanceSidebar(false)}
        />
      </SheetContent>
    </Sheet>
  )
}

export default GlobalAllowanceSidebar
