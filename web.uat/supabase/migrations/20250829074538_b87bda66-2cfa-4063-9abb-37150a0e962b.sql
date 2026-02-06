-- Update event markets to link to existing Global Leadership subcategory
UPDATE event_markets 
SET 
  category_id = (SELECT category_id FROM market_subcategories WHERE name = 'Global Leadership'),
  subcategory_id = '83e399cc-e4f4-4122-9775-cea856a50288'
WHERE name IN (
  'Will Donald Trump broker a Russia-Ukraine ceasefire by July 2025?',
  'Will Xi Jinping meet with Donald Trump in 2025?',
  'Will Germany''s CDU/CSU form a coalition excluding AfD in 2025?',
  'Will Alexander Lukashenko remain Belarus'' president by December 2025?',
  'Will the Shanghai Cooperation Organization expand membership in 2025?',
  'Will Norway''s Labour Party lose the parliamentary majority in 2025?',
  'Will Bolivia''s MAS party retain the presidency in August 2025?',
  'Will Guyana''s President Irfaan Ali be re-elected in September 2025?',
  'Will the UN General Assembly pass a global AI governance resolution in September 2025?',
  'Will Malawi''s President Lazarus Chakwera win re-election in September 2025?'
);

-- Remove the duplicate Global Leadership category we created
DELETE FROM market_categories WHERE name = 'Global Leadership' AND id != (
  SELECT category_id FROM market_subcategories WHERE name = 'Global Leadership'
);