-- Add five event markets to Political > Policy Outcomes category
INSERT INTO public.event_markets (
  name, description, relevance, why_it_matters, category_id, subcategory_id, 
  end_date, yes_price, no_price, volume, liquidity, is_active
) VALUES 
(
  'Will Trump''s approval rating be above 50% after one year in office?',
  'This market bets on whether Donald Trump''s approval rating will exceed 50% after his first year in his second term (by January 2026).',
  'Trump''s second term is a focal point for 2025, with his policy agenda—tariffs, immigration reform, and deregulation—driving public and market sentiment. Prediction markets like Manifold estimate a low probability (2% chance) of this outcome, citing historical data where Trump''s approval never surpassed 49% during his first term.',
  'Approval ratings influence legislative success and midterm election dynamics, making this a key indicator of Trump''s policy momentum.',
  '41584341-62ed-482b-bae2-95bb612e4e4f',
  '3fb00619-52ab-4a50-ac05-3b49fbbff59a',
  '2026-01-31T23:59:59Z',
  0.02,
  0.98,
  0,
  0,
  true
),
(
  'Will Trump end the war in Ukraine in his first 90 days?',
  'Traders wager on whether Trump can broker a resolution to the Russia-Ukraine conflict within 90 days of taking office (by April 2025).',
  'Trump''s campaign promises and his foreign policy stance, including a potential new alignment with Russia, make this a high-stakes market. It reflects expectations about his diplomatic influence and the geopolitical ripple effects on trade and energy markets.',
  'A resolution (or lack thereof) could impact global energy prices, NATO dynamics, and U.S. foreign policy credibility.',
  '41584341-62ed-482b-bae2-95bb612e4e4f',
  '3fb00619-52ab-4a50-ac05-3b49fbbff59a',
  '2025-04-30T23:59:59Z',
  0.25,
  0.75,
  0,
  0,
  true
),
(
  'Will Mike Johnson lose the House Speakership in 2025?',
  'This market predicts whether House Speaker Mike Johnson will be replaced in 2025, driven by internal GOP tensions.',
  'Johnson''s precarious position between Trump loyalists and moderates could destabilize Republican policy priorities, such as tax cuts or immigration reform. Prediction markets highlight this as a flashpoint for GOP unity.',
  'A change in speakership could delay or alter major policy initiatives, affecting markets and investor confidence.',
  '41584341-62ed-482b-bae2-95bb612e4e4f',
  '3fb00619-52ab-4a50-ac05-3b49fbbff59a',
  '2025-12-31T23:59:59Z',
  0.35,
  0.65,
  0,
  0,
  true
),
(
  'Will the U.S. debt ceiling be raised or suspended in 2025?',
  'Traders bet on whether Congress will lift or suspend the $36 trillion federal debt ceiling, likely needed by mid-2025.',
  'With unified Republican control, the outcome seems probable, but debates over debt and deficits could complicate GOP tax cut plans. This market gauges fiscal policy direction and potential market volatility.',
  'Failure to raise the debt ceiling could spark market uncertainty, while success might signal smoother fiscal policy execution.',
  '41584341-62ed-482b-bae2-95bb612e4e4f',
  '3fb00619-52ab-4a50-ac05-3b49fbbff59a',
  '2025-12-31T23:59:59Z',
  0.85,
  0.15,
  0,
  0,
  true
),
(
  'Will clean energy incentives from the Inflation Reduction Act be repealed in 2025?',
  'This market assesses whether the Republican-led Congress will roll back clean energy subsidies established under the Inflation Reduction Act.',
  'Despite GOP rhetoric, 80% of these funds benefit Republican districts, creating resistance to repeal. This market reflects tensions between traditional energy interests and emerging clean energy sectors.',
  'The outcome will influence energy markets, with implications for oil, gas, and renewable energy stocks.',
  '41584341-62ed-482b-bae2-95bb612e4e4f',
  '3fb00619-52ab-4a50-ac05-3b49fbbff59a',
  '2025-12-31T23:59:59Z',
  0.40,
  0.60,
  0,
  0,
  true
);