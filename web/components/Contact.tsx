import { useTranslation } from 'react-i18next'
import { Mail, MessageSquare, FileText } from 'lucide-react'

const Contact = () => {
  const { t } = useTranslation()

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-3xl font-bold text-foreground mb-2">Contact Us</h1>
      <p className="text-muted-foreground mb-8">We'd love to hear from you. Get in touch with our team.</p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
        {/* Email */}
        <div className="p-6 rounded-xl border border-border bg-card">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Email</h3>
          <p className="text-muted-foreground text-sm mb-3">Send us an email anytime</p>
          <a 
            href="mailto:info@prism.market" 
            className="text-primary hover:underline text-sm"
          >
            info@prism.market
          </a>
        </div>

        {/* Discord */}
        <div className="p-6 rounded-xl border border-border bg-card">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            <MessageSquare className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Discord</h3>
          <p className="text-muted-foreground text-sm mb-3">Join our community</p>
          <a 
            href="https://discord.gg/NbtNy49efc" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline text-sm"
          >
            Join Discord
          </a>
        </div>

        {/* Documentation */}
        <div className="p-6 rounded-xl border border-border bg-card">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Documentation</h3>
          <p className="text-muted-foreground text-sm mb-3">Read our guides and docs</p>
          <a 
            href="https://prism-market-labs.gitbook.io/prism-market-labs-docs/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-primary hover:underline text-sm"
          >
            View Docs
          </a>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-foreground mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="font-semibold text-foreground mb-2">How do I connect my wallet?</h3>
            <p className="text-muted-foreground text-sm">
              Click the "Connect Wallet" button in the header and select your preferred Hedera wallet (HashPack, Kabila, etc.).
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="font-semibold text-foreground mb-2">What tokens are supported?</h3>
            <p className="text-muted-foreground text-sm">
              Prism Market currently supports Hedera Native USDC.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="font-semibold text-foreground mb-2">Why am I asked to approve a USDC allowance?</h3>
            <p className="text-muted-foreground text-sm">
              Before your first order you grant the trading contract permission to spend USDC on your behalf. You can set a
              specific amount or choose Max, and you can change or revoke it any time from the Allowance Manager in your wallet menu.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="font-semibold text-foreground mb-2">How are orders matched?</h3>
            <p className="text-muted-foreground text-sm">
              Every market runs an order book. Your order rests until another order meets your price, then the two are matched.
              YES and NO prices in a market always add up to $1.00.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="font-semibold text-foreground mb-2">Is there a minimum order size?</h3>
            <p className="text-muted-foreground text-sm">
              Yes — the minimum order value is $0.01.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="font-semibold text-foreground mb-2">Can I cancel an order?</h3>
            <p className="text-muted-foreground text-sm">
              Any order that has not been filled can be cancelled from the order book or from the Open Orders tab in your
              portfolio. Cancelling asks your wallet for a signature; nothing is charged for it.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="font-semibold text-foreground mb-2">My trade went through but my portfolio looks out of date.</h3>
            <p className="text-muted-foreground text-sm">
              Balances and positions are read from the Hedera network, which can lag by a short moment after a trade.
              Use the refresh button on the portfolio page if a position has not appeared after a minute or two.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="font-semibold text-foreground mb-2">How do I collect winnings from a resolved market?</h3>
            <p className="text-muted-foreground text-sm">
              Once a market resolves, the winning shares can be redeemed from your portfolio. Each redemption is a single
              wallet approval and pays out in USDC.
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card">
            <h3 className="font-semibold text-foreground mb-2">What are rewards for placing limit orders?</h3>
            <p className="text-muted-foreground text-sm">
              Resting limit orders earn a score each hour based on how close your price is to the market and how long the
              order stays on the book. Scores accrue toward $PRSM.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

export default Contact