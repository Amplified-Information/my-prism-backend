# Security policy

Do not commit credentials, private keys, seed phrases, production addresses that grant authority, or populated `.secrets` files. Copy each service's `.secrets.example` to an untracked `.secrets` file for local development. Production values must come from the environment's secret manager and use separate identities for owner, oracle, settlement operator, payer and deployment automation.

The imported source archive contained populated secret files. Treat every value that ever appeared there as compromised: rotate it, revoke the prior value where possible, and review its provider logs before any mainnet deployment.

Report vulnerabilities privately to the project security contact. Include affected commit, impact, reproduction and suggested remediation. Do not include live credentials or user data in an issue.
