interface CardProps {
  href: string;
  img: string;
  imgAlt: string;
  gradient: string;
  title: string;
  description: string;
  learnMore: string;
}


const svgMap = {
  'trending-up': (
    <svg style={{ color: 'var(--prism-yellow)' }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-primary">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
      <polyline points="16 7 22 7 22 13"></polyline>
    </svg>
  ),
  'droplets': (
    <svg style={{ color: 'var(--prism-yellow)' }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-primary">
      <path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"></path>
      <path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"></path>
    </svg>
  ),
  'vote': (
    <svg style={{ color: 'var(--prism-yellow)' }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-primary">
      <path d="m9 12 2 2 4-4"></path>
      <path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5V7Z"></path>
      <path d="M22 19H2"></path>
    </svg>
  ),
  'coins': (
    <svg style={{ color: 'var(--prism-yellow)' }} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-primary">
      <circle cx="8" cy="8" r="6"></circle>
      <path d="M18.09 10.37A6 6 0 1 1 10.34 18"></path>
      <path d="M7 6h1v4"></path>
      <path d="m16.71 13.88.7.71-2.82 2.82"></path>
    </svg>
  )
}

const Card = ({ href, img, imgAlt, gradient, title, description, learnMore }: CardProps) => (
  <div className="group">
    <div className={`rounded-lg border bg-card text-card-foreground shadow-sm h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-linear-to-br ${gradient} border-border/40`}>
      <div className="p-6 flex flex-col items-start h-full">
        <a className="flex flex-col flex-1 w-full" href={href}>
          <div className="mb-4 p-3 rounded-lg bg-background/50 backdrop-blur-sm flex" title={imgAlt}>
            {svgMap[img]}
          </div>
          <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">{description}</p>
        </a>
        <a className="text-sm text-primary hover:underline font-medium mt-auto" href={href}>{learnMore}</a>
      </div>
    </div>
  </div>
)

const CopyTiles = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card
        href="/wiki#bet-on-events"
        img="trending-up"
        imgAlt="Trending Up"
        gradient="from-primary/20 to-primary/5"
        title="Bet on Events"
        description="Trade on real-world events with YES/NO predictions. View order books and place trades at your preferred odds."
        learnMore="Learn More →"
      />
      <Card
        href="/wiki#provide-liquidity"
        img="droplets"
        imgAlt="Droplets"
        gradient="from-primary/15 to-primary/5"
        title="Provide Liquidity"
        description="Provide pending limit orders within the spread to receive rewards."
        learnMore="Learn More →"
      />
      <Card
        href="/wiki#governance"
        img="vote"
        imgAlt="Vote"
        gradient="from-primary/10 to-primary/5"
        title="Governance"
        description="Vote on community proposals and shape the future of the platform."
        learnMore="Learn More →"
      />
      <Card
        href="/wiki#stake-prsm"
        img="coins"
        imgAlt="Coins"
        gradient="from-primary-glow/20 to-primary-glow/5"
        title="Stake PRSM"
        description="Stake PRSM tokens to earn xPRSM and participate in governance with enhanced voting power."
        learnMore="Learn More →"
      />
    </div>
  )
}

export default CopyTiles
