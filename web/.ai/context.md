# PrismPredictionIntent order types

| price_usd | primary_secondary | order type | note                                                             |
|-----------|-------------------|------------|------------------------------------------------------------------|
| positive  | p                 | BUY        |                                                                  |
| positive  | s                 | SELL       |                                                                  |
| negative  | p                 | SELL       | a negative price_usd with primary_secondary = 's' is a SELL/YES  |
| negative  | s                 | BUY        | a positive price_usd with a primary_secondary = 's' is a SELL/NO |
